import mongoose, { Schema, Document, Model } from 'mongoose';

export interface SessionParticipantDoc extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  blocked: boolean;
  joinedAt: Date;
  lastSeenAt: Date;
  /** Cached count of how many songs this user has added to this session this hour. */
  recentAdds: { hourStart: Date; count: number };
}

const SessionParticipantSchema = new Schema<SessionParticipantDoc>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blocked: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    recentAdds: {
      hourStart: { type: Date, default: () => new Date() },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: false },
);

SessionParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const SessionParticipant: Model<SessionParticipantDoc> =
  mongoose.model<SessionParticipantDoc>('SessionParticipant', SessionParticipantSchema);
