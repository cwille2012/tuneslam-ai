import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User';
import { signJwt } from '../utils/jwt';
import { validate } from '../middleware/validate';
import { AuthedRequest, requireUser } from '../middleware/auth';
import { publicUser } from '../services/serializers';
import { conflict, unauthorized } from '../utils/errors';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  email: z.string().email(),
  phone: z.string().min(7).max(40).optional(),
  password: z.string().min(8).max(128),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof registerSchema>;
    const existing = await User.findOne({
      $or: [{ username: body.username }, { email: body.email.toLowerCase() }],
    });
    if (existing) throw conflict('Username or email already in use.');
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      username: body.username,
      email: body.email.toLowerCase(),
      phone: body.phone,
      passwordHash,
      lastLogin: new Date(),
    });
    const token = signJwt({ sub: user._id.toString(), aud: 'usr' });
    res.json({ token, account: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  identifier: z.string().min(1), // username or email
  password: z.string().min(1),
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password } = req.body as z.infer<typeof loginSchema>;
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { username: identifier };
    const user = await User.findOne(query);
    if (!user || !user.passwordHash) throw unauthorized('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');
    user.lastLogin = new Date();
    await user.save();
    const token = signJwt({ sub: user._id.toString(), aud: 'usr' });
    res.json({ token, account: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireUser, (req: AuthedRequest, res: Response) => {
  res.json({ account: publicUser(req.user!) });
});

const updateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(40).optional(),
});

router.patch(
  '/me',
  requireUser,
  validate(updateSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const body = req.body as z.infer<typeof updateSchema>;
      if (body.username && body.username !== user.username) {
        const exists = await User.findOne({ username: body.username });
        if (exists) throw conflict('Username taken.');
        user.username = body.username;
      }
      if (body.email && body.email.toLowerCase() !== user.email) {
        const exists = await User.findOne({ email: body.email.toLowerCase() });
        if (exists) throw conflict('Email already in use.');
        user.email = body.email.toLowerCase();
      }
      if (body.phone !== undefined) user.phone = body.phone;
      await user.save();
      res.json({ account: publicUser(user) });
    } catch (e) {
      next(e);
    }
  },
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128),
});

router.post(
  '/me/password',
  requireUser,
  validate(passwordSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;
      if (user.passwordHash) {
        if (!currentPassword) throw unauthorized('Current password is required.');
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw unauthorized('Current password is incorrect.');
      }
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      await user.save();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
