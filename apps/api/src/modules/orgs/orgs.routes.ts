import { Router } from 'express';
import { prisma } from '../../db.js';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { inviteSchema, updateMemberRoleSchema } from '@costopt/shared';
import { recordAudit } from '../audit/audit.service.js';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export const orgsRouter = Router();

orgsRouter.use(requireAuth);

export async function getOrgContext(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: { include: { user: { select: { id: true, email: true, name: true } } } },
      invites: { where: { expiresAt: { gt: new Date() } } },
    },
  });
}

orgsRouter.get('/me', requirePermission('org:read'), async (req, res) => {
  const org = await getOrgContext(req.auth!.organizationId);
  if (!org) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }
  res.json({ organization: org });
});

orgsRouter.post('/invites', requirePermission('member:invite'), async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const organizationId = req.auth!.organizationId;
  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId,
      email: parsed.data.email,
      role: parsed.data.role as Role,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  await recordAudit({
    organizationId,
    userId: req.auth!.userId,
    action: 'member.invited',
    detail: { email: parsed.data.email, role: parsed.data.role },
  });
  res.status(201).json({ invite });
});

orgsRouter.post('/invites/accept', requireAuth, async (req, res) => {
  const { token, password, name } = req.body as {
    token?: string;
    password?: string;
    name?: string;
  };
  if (!token || !password || !name) {
    res.status(400).json({ error: 'token, password and name are required' });
    return;
  }
  const invite = await prisma.organizationInvite.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invalid or expired invite' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: invite.email, name, passwordHash },
    });
  }
  const membership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
    update: { role: invite.role },
    create: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
  });
  await prisma.organizationInvite.delete({ where: { id: invite.id } });
  await recordAudit({
    organizationId: invite.organizationId,
    userId: user.id,
    action: 'member.joined',
    detail: { role: membership.role },
  });
  res.json({ ok: true });
});

orgsRouter.patch(
  '/members/:membershipId',
  requirePermission('member:manage'),
  async (req, res) => {
    const parsed = updateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    const organizationId = req.auth!.organizationId;
    const membership = await prisma.membership.findFirst({
      where: { id: req.params.membershipId, organizationId },
    });
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }
    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: parsed.data.role as Role },
    });
    await recordAudit({
      organizationId,
      userId: req.auth!.userId,
      action: 'member.role_changed',
      detail: { membershipId: membership.id, role: parsed.data.role },
    });
    res.json({ membership: updated });
  }
);
