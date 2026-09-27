import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import type { RegisterInput, LoginInput } from '@costopt/shared';
import { Role } from '@prisma/client';

export interface AuthPayload {
  userId: string;
  organizationId: string;
  role: Role;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      memberships: {
        create: {
          role: Role.OWNER,
          organization: { create: { name: input.organizationName } },
        },
      },
    },
    include: { memberships: true },
  });

  const membership = user.memberships[0];
  const token = signToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: true },
  });
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');

  const membership = user.memberships[0];
  if (!membership) throw new Error('No organization membership');

  const token = signToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}
