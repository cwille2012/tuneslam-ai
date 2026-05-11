import mongoose, { Schema, Document, Model } from 'mongoose';
import type { SpotifyTrackSnapshot } from '@tuneslam/shared';

export type AddedByKind = 'admin' | 'user' | 'recommended';

export interface QueueItemDoc extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  track: SpotifyTrackSnapshot;
  addedBy: {
    kind: AddedByKind;
    id: mongoose.Types.ObjectId | null;
    label: string;
  };
  /** Map of voterKey -> +1/-1. voterKey is `${kind}:${id}`. */
  votes: Map<string, number>;
  netVotes: number;
  upvotes: number;
  downvotes: number;
  locked: boolean;
  addedAt: Date;
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

const QueueItemSchema = new Schema<QueueItemDoc>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    track: { type: TrackSnapshotSchema, required: true },
    addedBy: {
      kind: { type: String, enum: ['admin', 'user', 'recommended'], required: true },
      id: { type: Schema.Types.ObjectId, default: null },
      label: { type: String, required: true },
    },
    votes: { type: Map, of: Number, default: new Map() },
    netVotes: { type: Number, default: 0, index: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

QueueItemSchema.index({ sessionId: 1, 'track.id': 1 }, { unique: true });
QueueItemSchema.index({ sessionId: 1, locked: -1, netVotes: -1, addedAt: 1 });

export const QueueItem: Model<QueueItemDoc> = mongoose.model<QueueItemDoc>(
  'QueueItem',
  QueueItemSchema,
);

export function voterKey(kind: 'admin' | 'user', id: string): string {
  return `${kind}:${id}`;
}
