export const ROLES = ['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org:read',
  'org:write',
  'member:invite',
  'member:manage',
  'ingestion:create',
  'ingestion:read',
  'cost:read',
  'recommendation:read',
  'recommendation:run',
  'recommendation:act',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [
    'org:read',
    'org:write',
    'member:invite',
    'member:manage',
    'ingestion:create',
    'ingestion:read',
    'cost:read',
    'recommendation:read',
    'recommendation:run',
    'recommendation:act',
    'audit:read',
  ],
  ANALYST: [
    'org:read',
    'ingestion:create',
    'ingestion:read',
    'cost:read',
    'recommendation:read',
    'recommendation:run',
    'recommendation:act',
  ],
  VIEWER: ['org:read', 'ingestion:read', 'cost:read', 'recommendation:read'],
};

export const INGESTION_BATCH_STATUSES = [
  'PENDING',
  'PARSING',
  'NORMALIZING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
] as const;
export type IngestionBatchStatus = (typeof INGESTION_BATCH_STATUSES)[number];

export const RECOMMENDATION_TYPES = [
  'IDLE_RESOURCE',
  'RIGHTSIZING',
  'SPEND_ANOMALY',
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_STATUSES = [
  'OPEN',
  'ACCEPTED',
  'REJECTED',
  'IMPLEMENTED',
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const ACTION_STATUSES = ['SUGGESTED', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export * from './schemas.js';
