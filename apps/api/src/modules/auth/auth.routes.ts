import { Router } from 'express';
import { register, login } from './auth.service.js';
import { registerSchema, loginSchema } from '@costopt/shared';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  try {
    const result = await register(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  try {
    const result = await login(parsed.data);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
