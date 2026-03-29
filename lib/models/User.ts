import mongoose, { Schema } from 'mongoose';
import { IUser } from '@/lib/types';

const userSchema = new Schema<IUser>(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{10}$/,
    },
    profileDetails: {
      name: String,
      email: {
        type: String,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      address: String,
      callNumber: {
        type: String,
        match: /^[0-9]{10}$/,
      },
    },
    loyaltyCounter: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    passwordHash: {
      type: String,
    },
    passwordUpdatedAt: {
      type: Date,
    },
    lastPasswordLoginAt: {
      type: Date,
    },
    otpCode: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
