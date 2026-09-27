import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER', 'OWNER']),
});

// Ingestion
export const completeIngestionSchema = z.object({
  fileName: z.string().min(1),
  contentBase64: z.string().min(1),
});
export type CompleteIngestionInput = z.infer<typeof completeIngestionSchema>;

// Actions
export const recordActionSchema = z.object({
  action: z.enum(['ACCEPTED', 'REJECTED', 'IMPLEMENTED']),
  note: z.string().max(1000).optional(),
});
export type RecordActionInput = z.infer<typeof recordActionSchema>;

// Pagination / list query
export const listQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
