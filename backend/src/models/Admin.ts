import mongoose, { Schema, Document, Model } from 'mongoose';
import type { EncryptedBlob } from '../utils/crypto';

export interface AdminDoc extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  businessName?: string;
  spotify?: {
    userId?: string;
    accessTokenExpiresAt?: Date;
    accessToken?: EncryptedBlob | null;
    refreshToken?: EncryptedBlob | null;
    scope?: string;
  };
  // For player single-instance enforcement.
  activePlayerId?: string;
  activePlayerSince?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EncryptedBlobSchema = new Schema<EncryptedBlob>(
  { iv: String, tag: String, data: String },
  { _id: false },
);

const AdminSchema = new Schema<AdminDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'US' },
    },
    businessName: { type: String, trim: true },
    spotify: {
      userId: String,
      accessTokenExpiresAt: Date,
      accessToken: { type: EncryptedBlobSchema, default: null },
      refreshToken: { type: EncryptedBlobSchema, default: null },
      scope: String,
    },
    activePlayerId: String,
    activePlayerSince: Date,
  },
  { timestamps: true },
);

export const Admin: Model<AdminDoc> = mongoose.model<AdminDoc>('Admin', AdminSchema);
