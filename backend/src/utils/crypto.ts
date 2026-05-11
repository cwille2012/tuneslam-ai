import crypto from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(env.TOKEN_ENC_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENC_KEY must be 32 bytes (64 hex chars)');
  }
  return key;
}

export interface EncryptedBlob {
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

export function encrypt(plaintext: string): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') };
}

export function decrypt(blob: EncryptedBlob): string {
  const iv = Buffer.from(blob.iv, 'hex');
  const tag = Buffer.from(blob.tag, 'hex');
  const data = Buffer.from(blob.data, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function safeEncrypt(plaintext?: string | null): EncryptedBlob | null {
  if (!plaintext) return null;
  return encrypt(plaintext);
}

export function safeDecrypt(blob?: EncryptedBlob | null): string | null {
  if (!blob) return null;
  try {
    return decrypt(blob);
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}
