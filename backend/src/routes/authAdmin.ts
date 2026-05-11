import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Admin } from '../models/Admin';
import { signJwt } from '../utils/jwt';
import { validate } from '../middleware/validate';
import { AuthedRequest, requireAdmin } from '../middleware/auth';
import { publicAdmin } from '../services/serializers';
import { badRequest, conflict, unauthorized } from '../utils/errors';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(40),
  businessName: z.string().max(160).optional(),
  address: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(2).default('US'),
  }),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof registerSchema>;
    const existing = await Admin.findOne({ email: body.email.toLowerCase() });
    if (existing) throw conflict('Email already registered.');
    const passwordHash = await bcrypt.hash(body.password, 12);
    const admin = await Admin.create({
      email: body.email.toLowerCase(),
      passwordHash,
      name: body.name,
      phone: body.phone,
      businessName: body.businessName,
      address: body.address,
    });
    const token = signJwt({ sub: admin._id.toString(), aud: 'adm' });
    res.json({ token, account: publicAdmin(admin) });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) throw unauthorized('Invalid credentials');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw unauthorized('Invalid credentials');
    const token = signJwt({ sub: admin._id.toString(), aud: 'adm' });
    res.json({ token, account: publicAdmin(admin) });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAdmin, async (req: AuthedRequest, res: Response) => {
  res.json({ account: publicAdmin(req.admin!) });
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(40).optional(),
  businessName: z.string().max(160).optional(),
  address: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(2).default('US'),
  }).optional(),
});

router.patch(
  '/me',
  requireAdmin,
  validate(updateSchema),
  async (req: AuthedRequest, res: Response, next) => {
    try {
      const admin = req.admin!;
      const body = req.body as z.infer<typeof updateSchema>;
      if (body.name !== undefined) admin.name = body.name;
      if (body.phone !== undefined) admin.phone = body.phone;
      if (body.businessName !== undefined) admin.businessName = body.businessName;
      if (body.address) admin.address = { ...admin.address, ...body.address } as any;
      await admin.save();
      res.json({ account: publicAdmin(admin) });
    } catch (e) {
      next(e);
    }
  },
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

router.post(
  '/me/password',
  requireAdmin,
  validate(passwordSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;
      const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!ok) throw unauthorized('Current password is incorrect.');
      admin.passwordHash = await bcrypt.hash(newPassword, 12);
      await admin.save();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
