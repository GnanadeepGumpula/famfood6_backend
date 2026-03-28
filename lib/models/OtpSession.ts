import mongoose, { Document, Schema } from 'mongoose';

interface IOtpSessionDocument extends Document {
  mobileNumber: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSessionSchema = new Schema<IOtpSessionDocument>(
  {
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{10}$/,
    },
    otp: {
      type: String,
      required: true,
      match: /^[0-9]{6}$/,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const OtpSession =
  mongoose.models.OtpSession || mongoose.model<IOtpSessionDocument>('OtpSession', otpSessionSchema);

export default OtpSession;
