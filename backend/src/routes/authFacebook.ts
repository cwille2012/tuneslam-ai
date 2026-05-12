import { Router } from 'express';
import { z } from 'zod';
import {
  buildFacebookAuthUrl,
  linkFacebookToUser,
  loginWithFacebook,
} from '../services/facebook';
import { signJwt, verifyJwt } from '../utils/jwt';
import { env } from '../config/env';
import { badRequest } from '../utils/errors';
import { randomToken } from '../utils/crypto';
import { AuthedRequest, requireUser } from '../middleware/auth';
import { publicUser } from '../services/serializers';

const router = Router();


// =============================================================================
// LOGIN flow (unauthenticated): create-or-find a user from the FB profile.
// =============================================================================

router.get('/login/start', (req, res) => {
  // Caller may pass `?from=/some-slug` so we land them back on the session
  // page after the OAuth round-trip. We embed it in the signed state JWT so
  // it can't be tampered with mid-flight.
  const fromRaw = typeof req.query.from === 'string' ? req.query.from : '';
  const from = fromRaw.startsWith('/') ? fromRaw : '';
  const state = signJwt({
    sub: 'state',
    aud: 'usr',
    flow: 'fb-login',
    nonce: randomToken(8),
    from,
  } as any);
  res.redirect(buildFacebookAuthUrl(state));
});

// =============================================================================
// LINK flow (authenticated): attach FB to the CURRENT user without creating
// a new account. This is what /account → "Link Facebook" must use, otherwise
// the callback ends up swapping the active user (and silently dropping any
// previously-linked Spotify token along with it).
// =============================================================================

/**
 * Authenticated endpoint that returns the OAuth URL whose `state` JWT
 * carries the current user id. The frontend then top-level navigates to
 * that URL.
 *
 * We can't use the existing `/login/start` here because it's a plain
 * top-level GET (no auth header), so the backend has no way to know which
 * user is being linked.
 */
router.get('/link/url', requireUser, (req: AuthedRequest, res) => {
  const fromRaw = typeof req.query.from === 'string' ? req.query.from : '';
  const from = fromRaw.startsWith('/') ? fromRaw : '';
  const state = signJwt({
    sub: 'state',
    aud: 'usr',
    flow: 'fb-link',
    userId: req.user!._id.toString(),
    nonce: randomToken(8),
    from,
  } as any);
  res.json({ url: buildFacebookAuthUrl(state) });
});

// =============================================================================
// Callback (shared by both flows). Branches on `state.flow`.
// =============================================================================

const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(1) });

router.get('/callback', async (req, res, next) => {
  try {
    const parsed = callbackSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Missing code/state');

    let stateClaims: any;
    try {
      stateClaims = verifyJwt(parsed.data.state);
    } catch {
      throw badRequest('Invalid state');
    }

    const from =
      typeof stateClaims?.from === 'string' && stateClaims.from.startsWith('/')
        ? stateClaims.from
        : '';
    const flow = stateClaims?.flow === 'fb-link' ? 'fb-link' : 'fb-login';

    let user;
    if (flow === 'fb-link') {
      // Link FB to the SAME user that started the flow. The user id was
      // signed into `state` server-side, so it's tamper-proof.
      const userId = typeof stateClaims?.userId === 'string' ? stateClaims.userId : '';
      if (!userId) throw badRequest('Missing user in state');
      try {
        user = await linkFacebookToUser(userId, parsed.data.code);
      } catch (e: any) {
        // Surface the conflict ("already linked to another user") in the
        // URL so the frontend can show a friendly message.
        const msg = e?.message || 'Failed to link Facebook';
        return res.redirect(
          `${env.USER_URL}/facebook/callback?ok=0&error=${encodeURIComponent(msg)}`,
        );
      }
    } else {
      user = await loginWithFacebook(parsed.data.code);
    }

    const token = signJwt({ sub: user._id.toString(), aud: 'usr' });
    const fromParam = from ? `&from=${encodeURIComponent(from)}` : '';
    res.redirect(
      `${env.USER_URL}/facebook/callback?ok=1&token=${encodeURIComponent(token)}${fromParam}`,
    );
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// UNLINK: detach the FB id from the current user. Refuses to leave the user
// with no remaining way to log in.
// =============================================================================

router.post('/unlink', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const user = req.user!;
    // Don't let the user lock themselves out: they must still have either
    // a password or a linked Spotify (which doubles as a login method)
    // after the unlink completes.
    const hasPassword = Boolean(user.passwordHash);
    const hasSpotify = Boolean(user.spotify?.accessToken);
    if (!hasPassword && !hasSpotify) {
      throw badRequest(
        'Set a password (or link Spotify) before unlinking Facebook — otherwise you would lose access to your account.',
      );
    }
    user.facebookId = undefined;
    user.facebookProfile = undefined;
    await user.save();
    res.json({ account: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;

