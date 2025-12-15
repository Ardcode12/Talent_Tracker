// src/models/Video.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IVideo extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadDate: Date;
  analysis?: {
    jumpHeight?: number;
    strengths: string[];
    improvements: string[];
    score?: number;
    analyzedAt?: Date;
    modelVersion?: string;
  };
  validation?: {
    isValid: boolean;
    confidence: number;
    issues?: string[];
    validatedAt?: Date;
  };
  feedback?: {
    accuracyRating?: number;
    comments?: string;
    expertValidated?: boolean;
    correctJumpHeight?: number;
    validatedTechnique?: string;
    expertNotes?: string;
    expertId?: string;
    submittedAt?: Date;
    validatedAt?: Date;
  };
  calibration?: {
    pixelToCmRatio?: number;
    cameraHeight?: number;
    cameraDistance?: number;
    referenceObjectHeight?: number;
  };
  metadata?: {
    duration?: number;
    athleteName?: string;
  };
}

const VideoSchema: Schema = new Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  analysis: {
    jumpHeight: Number,
    strengths: [String],
    improvements: [String],
    score: Number,
    analyzedAt: Date,
    modelVersion: String,
  },
  validation: {
    isValid: { type: Boolean, default: true },
    confidence: { type: Number, default: 0 },
    issues: [String],
    validatedAt: Date,
  },
  feedback: {
    accuracyRating: { type: Number, min: 1, max: 5 },
    comments: String,
    expertValidated: Boolean,
    correctJumpHeight: Number,
    validatedTechnique: String,
    expertNotes: String,
    expertId: String,
    submittedAt: Date,
    validatedAt: Date,
  },
  calibration: {
    pixelToCmRatio: Number,
    cameraHeight: Number,
    cameraDistance: Number,
    referenceObjectHeight: Number,
  },
  metadata: {
    duration: Number,
    athleteName: String,
  },
}, {
  timestamps: true,
});

export default mongoose.model<IVideo>('Video', VideoSchema);
