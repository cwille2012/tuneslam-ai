import mongoose, { Schema, Document, Model } from 'mongoose';

export interface SessionParticipantDoc extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  blocked: boolean;
  joinedAt: Date;
  lastSeenAt: Date;
  /**
   * Per-hour quota tracking. `quotaHourStart` is shared by both the
   * songs and votes counters so they reset together — by spec the
   * two limits "should be synced (both reset at the same time)".
   *
   * `songsUsedThisHour` counts successful song adds (not rejections).
   * `votesUsedThisHour` counts successful vote presses (new vote,
   * flip, or cancel — every press that the server actually applied).
   *
   * Both fields are bumped only when the corresponding limit is
   * non-zero (i.e. enabled), but they're tracked unconditionally so
   * we don't need to migrate state when the admin toggles a limit on.
   *
   * Use {@link rolloverQuotaIfExpired} from `services/quota.ts` to
   * reset these once the hour has elapsed.
   */
  quotaHourStart: Date;
  songsUsedThisHour: number;
  votesUsedThisHour: number;
}

const SessionParticipantSchema = new Schema<SessionParticipantDoc>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blocked: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    quotaHourStart: { type: Date, default: () => new Date() },
    songsUsedThisHour: { type: Number, default: 0 },
    votesUsedThisHour: { type: Number, default: 0 },
  },
  {
    timestamps: false,
    // Tolerate legacy docs that still have `recentAdds: { hourStart, count }`
    // from an earlier schema. We don't read it; the new fields default
    // to "fresh hour" on first read so the user gets the configured
    // quota immediately. Existing data is left in place; it will fall
    // off naturally as participants are recreated.
    strict: false,
  },
);

SessionParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const SessionParticipant: Model<SessionParticipantDoc> =
  mongoose.model<SessionParticipantDoc>('SessionParticipant', SessionParticipantSchema);
