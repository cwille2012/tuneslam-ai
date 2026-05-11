import type { Request, Response, NextFunction } from 'express';
import { verifyJwt, JwtAudience, JwtPayload } from '../utils/jwt';
import { Admin, AdminDoc } from '../models/Admin';
import { User, UserDoc } from '../models/User';
import { unauthorized, forbidden } from '../utils/errors';

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
  admin?: AdminDoc;
  user?: UserDoc;
  /** For player tokens. */
  playerSession?: string;
}

export function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function authForAudiences(...audiences: JwtAudience[]) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next(unauthorized());
    let payload: JwtPayload;
    try {
      payload = verifyJwt(token);
    } catch {
      return next(unauthorized('Invalid or expired token'));
    }
    if (!audiences.includes(payload.aud)) return next(forbidden('Wrong audience'));
    req.auth = payload;
    if (payload.aud === 'adm') {
      const admin = await Admin.findById(payload.sub);
      if (!admin) return next(unauthorized('Account not found'));
      req.admin = admin;
    } else if (payload.aud === 'usr') {
      const user = await User.findById(payload.sub);
      if (!user) return next(unauthorized('Account not found'));
      req.user = user;
    } else if (payload.aud === 'player') {
      // Player tokens carry a session slug; the admin behind it is loaded by id.
      const admin = await Admin.findById(payload.sub);
      if (!admin) return next(unauthorized('Account not found'));
      req.admin = admin;
      req.playerSession = payload.session;
    }
    next();
  };
}

export const requireAdmin = authForAudiences('adm');
export const requireUser = authForAudiences('usr');
export const requirePlayer = authForAudiences('player');
export const requireAnyAccount = authForAudiences('adm', 'usr');

/** Optional auth: attaches account if a valid token is present, otherwise no-op. */
export async function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyJwt(token);
    req.auth = payload;
    if (payload.aud === 'adm') {
      const admin = await Admin.findById(payload.sub);
      if (admin) req.admin = admin;
    } else if (payload.aud === 'usr') {
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    }
  } catch {
    // ignore
  }
  next();
}
