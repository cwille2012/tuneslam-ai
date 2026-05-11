import { Router, Response } from 'express';
import { z } from 'zod';
import {
  buildAdminAuthUrl,
  buildUserAuthUrl,
  handleAdminCallback,
  handleUserCallback,
  loginUserWithSpotify,
} from '../services/spotify';
import { signJwt, verifyJwt } from '../utils/jwt';
import { AuthedRequest, requireAdmin, requireUser } from '../middleware/auth';
import { env } from '../config/env';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { badRequest, unauthorized } from '../utils/errors';
import { publicAdmin, publicUser } from '../services/serializers';
import { randomToken } from '../utils/crypto';

const router = Router();

/**
 * State payload encoded into the OAuth `state` query param.
 *  - For "link" flows we encode the user/admin id and an audience marker.
 *  - For "login" flows we encode just a CSRF nonce.
 * We sign it with our JWT secret to prevent tampering.
 */
function encodeState(payload: Record<string, any>): string {
  return signJwt({ sub: 'state', aud: 'usr', ...payload } as any);
}

function decodeState(state: string): any {
  try {
    return verifyJwt(state) as any;
  } catch {
    throw badRequest('Invalid OAuth state');
  }
}

/** Admin: start linking Spotify (called from authenticated dashboard). */
router.get('/admin/start', requireAdmin, (req: AuthedRequest, res) => {
  const state = encodeState({ flow: 'admin-link', adminId: req.admin!._id.toString(), nonce: randomToken(8) });
  res.redirect(buildAdminAuthUrl(state));
});

/** Admin: same as /admin/start but returns the URL as JSON (for SPA flows
 *  that can't attach an auth header to a top-level navigation). */
router.get('/admin/url', requireAdmin, (req: AuthedRequest, res) => {
  const state = encodeState({ flow: 'admin-link', adminId: req.admin!._id.toString(), nonce: randomToken(8) });
  res.json({ url: buildAdminAuthUrl(state) });
});

/** User: start linking Spotify to an existing logged-in user. */
router.get('/user/link/start', requireUser, (req: AuthedRequest, res) => {
  const state = encodeState({ flow: 'user-link', userId: req.user!._id.toString(), nonce: randomToken(8) });
  res.redirect(buildUserAuthUrl(state));
});

router.get('/user/link/url', requireUser, (req: AuthedRequest, res) => {
  const state = encodeState({ flow: 'user-link', userId: req.user!._id.toString(), nonce: randomToken(8) });
  res.json({ url: buildUserAuthUrl(state) });
});

/** User: start "login with Spotify" flow (no auth required). */
router.get('/user/login/start', (_req, res) => {
  const state = encodeState({ flow: 'user-login', nonce: randomToken(8) });
  res.redirect(buildUserAuthUrl(state));
});

router.get('/user/login/url', (_req, res) => {
  const state = encodeState({ flow: 'user-login', nonce: randomToken(8) });
  res.json({ url: buildUserAuthUrl(state) });
});

/** Single callback handles all Spotify flows. */
const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(1) });
router.get('/callback', async (req, res, next) => {
  try {
    const parsed = callbackSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Missing code/state');
    const { code, state } = parsed.data;
    const decoded = decodeState(state);
    const flow = decoded.flow as 'admin-link' | 'user-link' | 'user-login';
    if (flow === 'admin-link') {
      const admin = await Admin.findById(decoded.adminId);
      if (!admin) throw unauthorized();
      await handleAdminCallback(code, admin);
      const url = `${env.ADMIN_URL}/spotify/callback?ok=1`;
      return res.redirect(url);
    } else if (flow === 'user-link') {
      const user = await User.findById(decoded.userId);
      if (!user) throw unauthorized();
      await handleUserCallback(code, user);
      const url = `${env.USER_URL}/spotify/callback?ok=1`;
      return res.redirect(url);
    } else if (flow === 'user-login') {
      const user = await loginUserWithSpotify(code);
      const token = signJwt({ sub: user._id.toString(), aud: 'usr' });
      const url = `${env.USER_URL}/spotify/callback?ok=1&token=${encodeURIComponent(token)}`;
      return res.redirect(url);
    }
    throw badRequest('Unknown flow');
  } catch (e) {
    next(e);
  }
});

/** Unlink (admin). */
router.post('/admin/unlink', requireAdmin, async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    admin.spotify = undefined as any;
    await admin.save();
    res.json({ account: publicAdmin(admin) });
  } catch (e) {
    next(e);
  }
});

/** Unlink (user). */
router.post('/user/unlink', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const user = req.user!;
    user.spotify = undefined as any;
    user.spotifyUserId = undefined;
    await user.save();
    res.json({ account: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
