import { prisma } from '../../db.js';
import { logger } from '../../logger.js';
import type { RecommendationType } from '@costopt/shared';

interface Candidate {
  type: RecommendationType;
  serviceId: string | null;
  resourceKey: string;
  title: string;
  description: string;
  expectedMonthlySavings: number;
  confidence: number;
  inputs: Record<string, unknown>;
}

interface ResourceSeries {
  resourceKey: string;
  serviceId: string | null;
  daily: { date: string; amount: number }[];
}

const IDLE_DAILY_THRESHOLD = 0.01; // $/day considered ~zero
const IDLE_MIN_DAYS = 0.9; // >=90% of days near-zero
const ANOMALY_Z = 3.0;
const ANOMALY_MIN_BASE = 5; // ignore tiny series
const RIGHTSIZING_TOP_SHARE = 0.8; // one resource > 80% of service cost

export async function runRecommendations(organizationId: string, userId: string) {
  // Rule version: single active version for MVP
  let ruleVersion = await prisma.recommendationRuleVersion.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
  if (!ruleVersion) {
    ruleVersion = await prisma.recommendationRuleVersion.create({ data: { version: 1 } });
  }

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const lines = await prisma.normalizedCostLine.findMany({
    where: { organizationId, timeBucket: { gte: since } },
    select: {
      serviceId: true,
      resourceKey: true,
      timeBucket: true,
      amount: true,
    },
    orderBy: { timeBucket: 'asc' },
  });

  // Group into per-resource daily series
  const map = new Map<string, ResourceSeries>();
  for (const l of lines) {
    const key = `${l.serviceId ?? 'none'}::${l.resourceKey}`;
    let series = map.get(key);
    if (!series) {
      series = { resourceKey: l.resourceKey, serviceId: l.serviceId, daily: [] };
      map.set(key, series);
    }
    series.daily.push({
      date: l.timeBucket.toISOString().slice(0, 10),
      amount: Number(l.amount),
    });
  }

  const candidates: Candidate[] = [];
  for (const series of map.values()) {
    candidates.push(...evaluateIdle(series));
    candidates.push(...evaluateAnomaly(series));
  }
  candidates.push(...evaluateRightsizing(map.values()));

  // Deduplicate: one rec per (type, resourceKey) — keep highest savings
  const deduped = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.type}::${c.resourceKey}`;
    const prev = deduped.get(key);
    if (!prev || c.expectedMonthlySavings > prev.expectedMonthlySavings) {
      deduped.set(key, c);
    }
  }

  // Persist (upsert keeps stable identity per rule version)
  let created = 0;
  for (const c of deduped.values()) {
    await prisma.recommendation.upsert({
      where: {
        organizationId_type_resourceKey_ruleVersionId: {
          organizationId,
          type: c.type,
          resourceKey: c.resourceKey,
          ruleVersionId: ruleVersion.id,
        },
      },
      update: {
        expectedMonthlySavings: c.expectedMonthlySavings,
        confidence: c.confidence,
        inputs: c.inputs as never,
        description: c.description,
      },
      create: {
        organizationId,
        serviceId: c.serviceId,
        ruleVersionId: ruleVersion.id,
        type: c.type,
        title: c.title,
        description: c.description,
        resourceKey: c.resourceKey,
        expectedMonthlySavings: c.expectedMonthlySavings,
        confidence: c.confidence,
        inputs: c.inputs as never,
      },
    });
    created++;
  }

  await prisma.recommendation.updateMany({
    where: { organizationId, ruleVersionId: ruleVersion.id, type: 'SPEND_ANOMALY' },
    data: { status: 'OPEN' },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: 'recommendation.run',
      detail: { candidates: deduped.size, ruleVersion: ruleVersion.version },
    },
  });

  return { generated: created, ruleVersion: ruleVersion.version };
}

/** Rule 1 — Idle resource: near-zero spend on >=90% of observed days. */
function evaluateIdle(series: ResourceSeries): Candidate[] {
  const amounts = series.daily.map((d) => d.amount);
  if (amounts.length < 7) return []; // need at least a week of data
  const nearZeroDays = amounts.filter((a) => a <= IDLE_DAILY_THRESHOLD).length;
  const share = nearZeroDays / amounts.length;
  if (share < IDLE_MIN_DAYS) return [];

  const monthlyAvg = (amounts.reduce((a, b) => a + b, 0) / amounts.length) * 30;
  return [
    {
      type: 'IDLE_RESOURCE',
      serviceId: series.serviceId,
      resourceKey: series.resourceKey,
      title: `Idle resource: ${series.resourceKey}`,
      description: `Spend is near zero on ${Math.round(share * 100)}% of the last ${amounts.length} days. Consider decommissioning or scheduling this resource.`,
      expectedMonthlySavings: round2(monthlyAvg * 0.9),
      confidence: Math.min(0.6 + share * 0.35, 0.95),
      inputs: { observedDays: amounts.length, nearZeroShare: share, threshold: IDLE_DAILY_THRESHOLD },
    },
  ];
}

/** Rule 2 — Spend anomaly: latest day > z-score threshold vs. prior days. */
function evaluateAnomaly(series: ResourceSeries): Candidate[] {
  const amounts = series.daily.map((d) => d.amount);
  if (amounts.length < 14) return [];
  const history = amounts.slice(0, -1);
  const latest = amounts[amounts.length - 1];
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  if (mean < ANOMALY_MIN_BASE) return [];
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const std = Math.sqrt(variance);
  if (std === 0) return [];
  const z = (latest - mean) / std;
  if (z < ANOMALY_Z) return [];

  const excess = latest - mean;
  return [
    {
      type: 'SPEND_ANOMALY',
      serviceId: series.serviceId,
      resourceKey: series.resourceKey,
      title: `Spend spike: ${series.resourceKey}`,
      description: `Latest daily cost is ${z.toFixed(1)}σ above the trailing average ($${mean.toFixed(2)}/day → $${latest.toFixed(2)}/day). Investigate recent changes.`,
      expectedMonthlySavings: round2(excess * 30 * 0.5),
      confidence: Math.min(0.5 + (z - ANOMALY_Z) * 0.1, 0.9),
      inputs: { mean, latest, zScore: z, days: history.length },
    } as Candidate,
  ];
}

/** Rule 3 — Right-sizing heuristic: single resource dominating a service's cost. */
function evaluateRightsizing(seriesIter: Iterable<ResourceSeries>): Candidate[] {
  const byService = new Map<string, ResourceSeries[]>();
  for (const s of seriesIter) {
    if (!s.serviceId) continue;
    const list = byService.get(s.serviceId) ?? [];
    list.push(s);
    byService.set(s.serviceId, list);
  }

  const candidates: Candidate[] = [];
  for (const [serviceId, list] of byService) {
    const totals = list.map((s) => ({
      series: s,
      total: s.daily.reduce((a, b) => a + b.amount, 0),
    }));
    const grandTotal = totals.reduce((a, t) => a + t.total, 0);
    if (grandTotal <= 0 || totals.length < 2) continue;
    const top = totals.sort((a, b) => b.total - a.total)[0];
    const share = top.total / grandTotal;
    if (share < RIGHTSIZING_TOP_SHARE) continue;
    const monthly = (top.total / Math.max(top.series.daily.length, 1)) * 30;
    candidates.push({
      type: 'RIGHTSIZING',
      serviceId,
      resourceKey: top.series.resourceKey,
      title: `Review dominant resource: ${top.series.resourceKey}`,
      description: `This resource accounts for ${Math.round(share * 100)}% of its service's spend. Evaluate a smaller instance size or commitment coverage.`,
      expectedMonthlySavings: round2(monthly * 0.3),
      confidence: 0.55,
      inputs: { serviceId, costShare: share, observedDays: top.series.daily.length },
    });
  }
  return candidates;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
