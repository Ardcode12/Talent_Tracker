// src/ai/types.ts
export interface Keypoint {
  part: string;
  position: {
    x: number;
    y: number;
  };
  score: number;
}

export interface JumpPhases {
  preparationFrame: number;
  takeoffFrame: number;
  peakFrame: number;
  landingFrame: number;
}

export interface AnalysisResult {
  score: number;
  jumpHeight: number;
  strengths: string[];
  improvements: string[];
  technicalDetails: any;
}

export interface Analysis {
  strengths: string[];
  improvements: string[];
}

export interface JumpMetrics {
  jumpHeight: number;
  kneeBendAngle: number;
  armSwingVelocity: number;
  hipExtensionAngle: number;
  takeoffVelocity: number;
  landingStability: number;
  overallScore: number;
}
