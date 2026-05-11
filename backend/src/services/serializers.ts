import type { AdminDoc } from '../models/Admin';
import type { UserDoc } from '../models/User';
import type { SessionDoc } from '../models/Session';
import type {
  PublicAdmin,
  PublicUser,
  SessionDTO,
  UserStats,
  NowPlayingDTO,
} from '@tuneslam/shared';

export function publicAdmin(admin: AdminDoc): PublicAdmin {
  return {
    id: admin._id.toString(),
    email: admin.email,
    name: admin.name,
    businessName: admin.businessName,
    spotifyLinked: Boolean(admin.spotify?.accessToken),
  };
}

export function publicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    facebookLinked: Boolean(user.facebookId),
    spotifyLinked: Boolean(user.spotify?.accessToken),
    karma: user.stats?.karma ?? 0,
  };
}

export function userStats(user: UserDoc): UserStats {
  return {
    songsAdded: user.stats?.songsAdded ?? 0,
    songsUpvoted: user.stats?.songsUpvoted ?? 0,
    songsDownvoted: user.stats?.songsDownvoted ?? 0,
    songsPlayed: user.stats?.songsPlayed ?? 0,
    karma: user.stats?.karma ?? 0,
    sessionsJoined: user.sessionsJoined?.length ?? 0,
    lastLogin: user.lastLogin?.toISOString(),
  };
}

export function sessionDTO(session: SessionDoc, admin: AdminDoc): SessionDTO {
  return {
    id: session._id.toString(),
    slug: session.slug,
    active: session.active,
    spotifyLinked: Boolean(admin.spotify?.accessToken),
    settings: session.settings,
    adminLabel: admin.businessName || admin.name,
  };
}

export function nowPlayingDTO(session: SessionDoc): NowPlayingDTO {
  return {
    track: session.nowPlaying.track,
    startedAt: session.nowPlaying.startedAt?.toISOString(),
    isPaused: session.nowPlaying.isPaused,
    progressMs: session.nowPlaying.progressMs,
  };
}
