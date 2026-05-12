import axios from 'axios';
import { env, facebookConfigured } from '../config/env';
import { User, UserDoc } from '../models/User';
import { badRequest, notFound, serverError } from '../utils/errors';

const FB_OAUTH = 'https://www.facebook.com/v18.0/dialog/oauth';
const FB_TOKEN = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FB_ME = 'https://graph.facebook.com/v18.0/me';

export interface FacebookProfile {
  id: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
}


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

/**
 * Exchange the OAuth `code` for an access token and fetch the FB user
 * profile. Used by both the login-with-Facebook flow and the link-Facebook
 * flow, which differ only in what they do with the returned profile.
 */
export async function fetchFacebookProfile(code: string): Promise<FacebookProfile> {
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
    params: {
      access_token: accessToken,
      // `picture.type(large)` returns a 200x200 (or larger) avatar URL
      // under `picture.data.url`. We flatten it below.
      fields: 'id,name,email,picture.type(large)',
    },
  });
  const raw = profileRes.data as {
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  };
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    // Skip the FB default silhouette so we don't store a placeholder.
    pictureUrl:
      raw.picture?.data && !raw.picture.data.is_silhouette
        ? raw.picture.data.url
        : undefined,
  };
}


/**
 * "Login with Facebook": find-or-create a user from the FB profile.
 * Used by the unauthenticated login-start flow on the user frontend.
 */
export async function loginWithFacebook(code: string): Promise<UserDoc> {
  const profile = await fetchFacebookProfile(code);

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
  user.facebookProfile = {
    name: profile.name,
    pictureUrl: profile.pictureUrl,
  };
  user.lastLogin = new Date();
  await user.save();
  return user;
}

/**
 * "Link Facebook": attach the FB id to an EXISTING (already-authenticated)

 * user. Crucially, this never creates a new account — so doing this from
 * `/account` while signed-in won't blow away the user's other linked
 * services (e.g. Spotify) the way a "login" flow would.
 */
export async function linkFacebookToUser(
  userId: string,
  code: string,
): Promise<UserDoc> {
  const profile = await fetchFacebookProfile(code);

  // Reject if a *different* user already owns this FB id — prevents one
  // person hijacking another's Facebook link.
  const conflict = await User.findOne({
    facebookId: profile.id,
    _id: { $ne: userId },
  });
  if (conflict) {
    throw badRequest(
      'That Facebook account is already linked to a different TuneSlam user.',
    );
  }

  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  user.facebookId = profile.id;
  user.facebookProfile = {
    name: profile.name,
    pictureUrl: profile.pictureUrl,
  };
  // Opportunistically fill in email if the user didn't have one yet.
  if (!user.email && profile.email) {
    user.email = profile.email.toLowerCase();
  }
  user.lastLogin = new Date();
  await user.save();
  return user;
}

