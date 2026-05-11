import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type JwtAudience = 'adm' | 'usr' | 'player';

export interface JwtPayload {
  sub: string;
  aud: JwtAudience;
  /** Session slug (only present for player tokens). */
  session?: string;
}

export function signJwt(payload: JwtPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { iat: number; exp: number };
  if (!decoded || typeof decoded.sub !== 'string' || !decoded.aud) {
    throw new Error('Invalid token payload');
  }
  return decoded;
}
