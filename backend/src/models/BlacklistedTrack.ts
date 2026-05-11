import mongoose, { Schema, Document, Model } from 'mongoose';

export interface BlacklistedTrackDoc extends Document {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  trackId: string;
  trackName: string;
  artistsJoined: string;
  albumArt?: string;
  createdAt: Date;
}

const BlacklistedTrackSchema = new Schema<BlacklistedTrackDoc>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    trackId: { type: String, required: true },
    trackName: { type: String, required: true },
    artistsJoined: { type: String, required: true },
    albumArt: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BlacklistedTrackSchema.index({ adminId: 1, trackId: 1 }, { unique: true });

export const BlacklistedTrack: Model<BlacklistedTrackDoc> = mongoose.model<BlacklistedTrackDoc>(
  'BlacklistedTrack',
  BlacklistedTrackSchema,
);
