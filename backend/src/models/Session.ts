import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  DEFAULT_SESSION_SETTINGS,
  SessionSettings,
  SpotifyTrackSnapshot,
} from '@tuneslam/shared';

export interface NowPlayingState {
  track: SpotifyTrackSnapshot | null;
  startedAt?: Date;
  isPaused: boolean;
  progressMs: number;
  /** When the queue item was marked as "played" (>=50% progress). */
  markedPlayed: boolean;
  /** ID of the queue item this corresponds to (so we can resume). */
  sourceQueueItemId?: mongoose.Types.ObjectId;
}

export interface SessionDoc extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  adminId: mongoose.Types.ObjectId;
  active: boolean;
  settings: SessionSettings;
  nowPlaying: NowPlayingState;
  /** Queue item id of the locked-next track. Null if none. */
  lockedNextQueueItemId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TrackSnapshotSchema = new Schema<SpotifyTrackSnapshot>(
  {
    id: String,
    name: String,
    artists: [{ id: String, name: String }],
    durationMs: Number,
    popularity: Number,
    albumArt: String,
  },
  { _id: false },
);

const SessionSchema = new Schema<SessionDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      unique: true, // one session per admin
      index: true,
    },
    active: { type: Boolean, default: false },
    settings: {
      popularityThreshold: { type: Number, default: DEFAULT_SESSION_SETTINGS.popularityThreshold },
      maxSongLengthMs: { type: Number, default: DEFAULT_SESSION_SETTINGS.maxSongLengthMs },
      lockAheadSec: { type: Number, default: DEFAULT_SESSION_SETTINGS.lockAheadSec },
      autofillMode: {
        type: String,
        enum: ['off', 'playlist', 'related', 'genre'],
        default: DEFAULT_SESSION_SETTINGS.autofillMode,
      },
      autofillPlaylistId: { type: String, default: '' },
      autofillGenre: { type: String, default: '' },
      autofillMin: { type: Number, default: DEFAULT_SESSION_SETTINGS.autofillMin },
      maxSongsPerUserPerHour: {
        type: Number,
        default: DEFAULT_SESSION_SETTINGS.maxSongsPerUserPerHour,
      },
      downvoteThreshold: { type: Number, default: DEFAULT_SESSION_SETTINGS.downvoteThreshold },
      allowReadd: { type: Boolean, default: DEFAULT_SESSION_SETTINGS.allowReadd },
    },
    nowPlaying: {
      track: { type: TrackSnapshotSchema, default: null },
      startedAt: Date,
      isPaused: { type: Boolean, default: true },
      progressMs: { type: Number, default: 0 },
      markedPlayed: { type: Boolean, default: false },
      sourceQueueItemId: { type: Schema.Types.ObjectId },
    },
    lockedNextQueueItemId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

export const Session: Model<SessionDoc> = mongoose.model<SessionDoc>('Session', SessionSchema);
