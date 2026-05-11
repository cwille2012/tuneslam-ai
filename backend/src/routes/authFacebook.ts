import { Router } from 'express';
import { z } from 'zod';
import { buildFacebookAuthUrl, loginWithFacebook } from '../services/facebook';
import { signJwt, verifyJwt } from '../utils/jwt';
import { env } from '../config/env';
import { badRequest } from '../utils/errors';
import { randomToken } from '../utils/crypto';

const router = Router();

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

const callbackSchema = z.object({ code: z.string().min(1), state: z.string().min(1) });

router.get('/callback', async (req, res, next) => {
  try {
    const parsed = callbackSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Missing code/state');
    let from = '';
    try {
      const stateClaims = verifyJwt(parsed.data.state) as any;
      if (typeof stateClaims?.from === 'string' && stateClaims.from.startsWith('/')) {
        from = stateClaims.from;
      }
    } catch {
      throw badRequest('Invalid state');
    }
    const user = await loginWithFacebook(parsed.data.code);
    const token = signJwt({ sub: user._id.toString(), aud: 'usr' });
    const fromParam = from ? `&from=${encodeURIComponent(from)}` : '';
    res.redirect(
      `${env.USER_URL}/facebook/callback?ok=1&token=${encodeURIComponent(token)}${fromParam}`,
    );
  } catch (e) {
    next(e);
  }
});

export default router;
