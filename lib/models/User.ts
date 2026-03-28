import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '@/lib/types';

interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
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
    },
    loyaltyCounter: {
      type: Map,
      of: Number,
      default: new Map(),
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
  mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);

export default User;
