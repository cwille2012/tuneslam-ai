import { Router } from 'express';
import { Session } from '../models/Session';
import { Admin } from '../models/Admin';
import { sessionDTO, nowPlayingDTO } from '../services/serializers';
import { notFound } from '../utils/errors';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

router.get('/sessions/:slug/exists', async (req, res, next) => {
  try {
    const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
    if (!session) return res.json({ exists: false });
    const admin = await Admin.findById(session.adminId);
    if (!admin) return res.json({ exists: false });
    res.json({ exists: true, session: sessionDTO(session, admin) });
  } catch (e) {
    next(e);
  }
});

router.get('/sessions/:slug/now-playing', async (req, res, next) => {
  try {
    const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
    if (!session) throw notFound('Session not found');
    res.json({ nowPlaying: nowPlayingDTO(session) });
  } catch (e) {
    next(e);
  }
});

export default router;
