import mongoose, { Schema, Document, Model } from 'mongoose';
import type { EncryptedBlob } from '../utils/crypto';

export interface UserDoc extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email?: string;
  phone?: string;
  passwordHash?: string;

  facebookId?: string;
  spotifyUserId?: string;
  spotify?: {
    accessTokenExpiresAt?: Date;
    accessToken?: EncryptedBlob | null;
    refreshToken?: EncryptedBlob | null;
    scope?: string;
  };

  // Stats counters (updated as actions occur).
  stats: {
    songsAdded: number;
    songsUpvoted: number;
    songsDownvoted: number;
    songsPlayed: number;
    karma: number;
  };
  sessionsJoined: mongoose.Types.ObjectId[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EncryptedBlobSchema = new Schema<EncryptedBlob>(
  { iv: String, tag: String, data: String },
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true, unique: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String },

    facebookId: { type: String, sparse: true, unique: true, index: true },
    spotifyUserId: { type: String, sparse: true, unique: true, index: true },
    spotify: {
      accessTokenExpiresAt: Date,
      accessToken: { type: EncryptedBlobSchema, default: null },
      refreshToken: { type: EncryptedBlobSchema, default: null },
      scope: String,
    },

    stats: {
      songsAdded: { type: Number, default: 0 },
      songsUpvoted: { type: Number, default: 0 },
      songsDownvoted: { type: Number, default: 0 },
      songsPlayed: { type: Number, default: 0 },
      karma: { type: Number, default: 0 },
    },
    sessionsJoined: [{ type: Schema.Types.ObjectId, ref: 'Session' }],
    lastLogin: Date,
  },
  { timestamps: true },
);

export const User: Model<UserDoc> = mongoose.model<UserDoc>('User', UserSchema);
