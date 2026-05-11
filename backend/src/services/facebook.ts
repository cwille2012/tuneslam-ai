import axios from 'axios';
import { env, facebookConfigured } from '../config/env';
import { User, UserDoc } from '../models/User';
import { serverError } from '../utils/errors';

const FB_OAUTH = 'https://www.facebook.com/v18.0/dialog/oauth';
const FB_TOKEN = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FB_ME = 'https://graph.facebook.com/v18.0/me';

export function buildFacebookAuthUrl(state: string): string {
  if (!facebookConfigured()) throw serverError('Facebook is not configured');
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: env.FACEBOOK_REDIRECT_URI,
    state,
    scope: 'public_profile,email',
    response_type: 'code',
  });
  return `${FB_OAUTH}?${params.toString()}`;
}

export async function loginWithFacebook(code: string): Promise<UserDoc> {
  if (!facebookConfigured()) throw serverError('Facebook is not configured');
  const tokenRes = await axios.get(FB_TOKEN, {
    params: {
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      redirect_uri: env.FACEBOOK_REDIRECT_URI,
      code,
    },
  });
  const accessToken = tokenRes.data.access_token as string;
  const profileRes = await axios.get(FB_ME, {
    params: { access_token: accessToken, fields: 'id,name,email' },
  });
  const profile = profileRes.data as { id: string; name?: string; email?: string };

  let user = await User.findOne({ facebookId: profile.id });
  if (!user && profile.email) {
    user = await User.findOne({ email: profile.email.toLowerCase() });
  }
  if (!user) {
    const baseUsername =
      (profile.name || profile.id).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) ||
      `tuner${Math.floor(Math.random() * 100000)}`;
    let username = baseUsername;
    let suffix = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await User.findOne({ username });
      if (!exists) break;
      suffix += 1;
      username = `${baseUsername}${suffix}`;
    }
    user = await User.create({
      username,
      email: profile.email?.toLowerCase(),
      facebookId: profile.id,
    });
  }
  user.facebookId = profile.id;
  user.lastLogin = new Date();
  await user.save();
  return user;
}
