import mongoose, { Schema, Document, Model } from 'mongoose';
import type { SpotifyTrackSnapshot } from '@tuneslam/shared';
import type { AddedByKind } from './QueueItem';

export interface PlayedSongDoc extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  track: SpotifyTrackSnapshot;
  addedBy: {
    kind: AddedByKind;
    id: mongoose.Types.ObjectId | null;
    label: string;
  };
  playedAt: Date;
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

const PlayedSongSchema = new Schema<PlayedSongDoc>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    track: { type: TrackSnapshotSchema, required: true },
    addedBy: {
      kind: { type: String, enum: ['admin', 'user', 'recommended'], required: true },
      id: { type: Schema.Types.ObjectId, default: null },
      label: { type: String, required: true },
    },
    playedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

PlayedSongSchema.index({ sessionId: 1, 'track.id': 1 });

export const PlayedSong: Model<PlayedSongDoc> = mongoose.model<PlayedSongDoc>(
  'PlayedSong',
  PlayedSongSchema,
);
