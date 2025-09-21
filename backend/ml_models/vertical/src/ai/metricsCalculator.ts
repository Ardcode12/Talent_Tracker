import { Keypoint, JumpPhases } from './types';

// Constants for calculation
const PIXEL_TO_CM_RATIO = 0.264583; // This should be calibrated based on your camera setup
const FRAME_RATE = 30; // frames per second

interface JumpMetrics {
  jumpHeight: number;
  kneeBendAngle: number;
  armSwingVelocity: number;
  hipExtensionAngle: number;
  takeoffVelocity: number;
  landingStability: number;
  overallScore: number;
}

export function calculateMetrics(keypoints: Keypoint[][]): JumpMetrics {
  // Find key phases
  const phases = identifyJumpPhases(keypoints);
  
  // Calculate jump height using keypoint trajectories
  const jumpHeight = calculateJumpHeight(
    keypoints,
    phases.takeoffFrame,
    phases.peakFrame
  );
  
  // Calculate biomechanical angles
  const kneeBendAngle = calculateKneeAngle(
    keypoints[phases.preparationFrame]
  );
  
  // Calculate hip extension
  const hipExtensionAngle = calculateHipExtension(
    keypoints[phases.takeoffFrame]
  );
  
  // Calculate velocities
  const armSwingVelocity = calculateArmVelocity(
    keypoints,
    phases.preparationFrame,
    phases.takeoffFrame
  );
  
  // Calculate takeoff velocity
  const takeoffVelocity = calculateTakeoffVelocity(
    keypoints,
    phases.takeoffFrame - 3,
    phases.takeoffFrame
  );
  
  // Calculate landing stability
  const landingStability = calculateLandingStability(
    keypoints,
    phases.landingFrame
  );
  
  // Generate overall score
  const overallScore = calculateOverallScore({
    jumpHeight,
    kneeBendAngle,
    armSwingVelocity,
    hipExtensionAngle,
    takeoffVelocity,
    landingStability
  });
  
  return {
    jumpHeight,
    kneeBendAngle,
    armSwingVelocity,
    hipExtensionAngle,
    takeoffVelocity,
    landingStability,
    overallScore
  };
}

function identifyJumpPhases(keypoints: Keypoint[][]): JumpPhases {
  // Find the lowest point (maximum knee bend)
  let lowestHipFrame = 0;
  let lowestHipY = 0;
  
  // Find the highest point (peak of jump)
  let highestHipFrame = 0;
  let highestHipY = Infinity;
  
  for (let i = 0; i < keypoints.length; i++) {
    const leftHip = keypoints[i].find(kp => kp.part === 'leftHip');
    const rightHip = keypoints[i].find(kp => kp.part === 'rightHip');
    
    if (leftHip && rightHip) {
      const avgHipY = (leftHip.position.y + rightHip.position.y) / 2;
      
      if (avgHipY > lowestHipY) {
        lowestHipY = avgHipY;
        lowestHipFrame = i;
      }
      
      if (avgHipY < highestHipY) {
        highestHipY = avgHipY;
        highestHipFrame = i;
      }
    }
  }
  
  // Takeoff is typically a few frames after the lowest point
  const takeoffFrame = Math.min(lowestHipFrame + 5, keypoints.length - 1);
  
  // Landing is when the person returns to ground level after peak
  let landingFrame = highestHipFrame;
  for (let i = highestHipFrame + 1; i < keypoints.length; i++) {
    const leftHip = keypoints[i].find(kp => kp.part === 'leftHip');
    if (leftHip && leftHip.position.y > lowestHipY * 0.9) {
      landingFrame = i;
      break;
    }
  }
  
  return {
    preparationFrame: lowestHipFrame,
    takeoffFrame: takeoffFrame,
    peakFrame: highestHipFrame,
    landingFrame: landingFrame
  };
}

function calculateJumpHeight(keypoints: Keypoint[][], takeoff: number, peak: number): number {
  const hipAtTakeoff = getAverageHipPosition(keypoints[takeoff]);
  const hipAtPeak = getAverageHipPosition(keypoints[peak]);
  
  if (!hipAtTakeoff || !hipAtPeak) {
    return 0;
  }
  
  // Convert pixel difference to real-world height
  const pixelDiff = hipAtTakeoff.y - hipAtPeak.y;
  const heightCm = Math.abs(pixelDiff * PIXEL_TO_CM_RATIO);
  
  return Math.round(heightCm * 10) / 10; // Round to 1 decimal place
}

function getAverageHipPosition(keypoints: Keypoint[]): { x: number, y: number } | null {
  const leftHip = keypoints.find(kp => kp.part === 'leftHip');
  const rightHip = keypoints.find(kp => kp.part === 'rightHip');
  
  if (!leftHip || !rightHip) {
    return null;
  }
  
  return {
    x: (leftHip.position.x + rightHip.position.x) / 2,
    y: (leftHip.position.y + rightHip.position.y) / 2
  };
}

function calculateKneeAngle(keypoints: Keypoint[]): number {
  const leftHip = keypoints.find(kp => kp.part === 'leftHip');
  const leftKnee = keypoints.find(kp => kp.part === 'leftKnee');
  const leftAnkle = keypoints.find(kp => kp.part === 'leftAnkle');
  
  if (!leftHip || !leftKnee || !leftAnkle) {
    return 90; // Default angle
  }
  
  // Calculate angle using dot product
  const v1 = {
    x: leftHip.position.x - leftKnee.position.x,
    y: leftHip.position.y - leftKnee.position.y
  };
  
  const v2 = {
    x: leftAnkle.position.x - leftKnee.position.x,
    y: leftAnkle.position.y - leftKnee.position.y
  };
  
  const angle = calculateAngleBetweenVectors(v1, v2);
  return Math.round(angle);
}

function calculateHipExtension(keypoints: Keypoint[]): number {
  const leftShoulder = keypoints.find(kp => kp.part === 'leftShoulder');
  const leftHip = keypoints.find(kp => kp.part === 'leftHip');
  const leftKnee = keypoints.find(kp => kp.part === 'leftKnee');
  
  if (!leftShoulder || !leftHip || !leftKnee) {
    return 180; // Default angle
  }
  
  const v1 = {
    x: leftShoulder.position.x - leftHip.position.x,
    y: leftShoulder.position.y - leftHip.position.y
  };
  
  const v2 = {
    x: leftKnee.position.x - leftHip.position.x,
    y: leftKnee.position.y - leftHip.position.y
  };
  
  const angle = calculateAngleBetweenVectors(v1, v2);
  return Math.round(angle);
}

function calculateArmVelocity(keypoints: Keypoint[][], startFrame: number, endFrame: number): number {
  const startWrist = keypoints[startFrame].find(kp => kp.part === 'leftWrist');
  const endWrist = keypoints[endFrame].find(kp => kp.part === 'leftWrist');
  
  if (!startWrist || !endWrist) {
    return 0;
  }
  
  // Calculate distance traveled
  const distance = Math.sqrt(
    Math.pow(endWrist.position.x - startWrist.position.x, 2) +
    Math.pow(endWrist.position.y - startWrist.position.y, 2)
  );
  
  // Calculate time elapsed
  const timeElapsed = (endFrame - startFrame) / FRAME_RATE;
  
  // Velocity in pixels per second, convert to m/s
  const velocityPixelsPerSec = distance / timeElapsed;
  const velocityMetersPerSec = velocityPixelsPerSec * PIXEL_TO_CM_RATIO / 100;
  
  return Math.round(velocityMetersPerSec * 10) / 10;
}

function calculateTakeoffVelocity(keypoints: Keypoint[][], startFrame: number, endFrame: number): number {
  const startHip = getAverageHipPosition(keypoints[startFrame]);
  const endHip = getAverageHipPosition(keypoints[endFrame]);
  
  if (!startHip || !endHip) {
    return 0;
  }
  
  // Calculate vertical displacement
  const verticalDisplacement = startHip.y - endHip.y;
  const timeElapsed = (endFrame - startFrame) / FRAME_RATE;
  
  // Velocity in pixels per second, convert to m/s
  const velocityPixelsPerSec = verticalDisplacement / timeElapsed;
  const velocityMetersPerSec = velocityPixelsPerSec * PIXEL_TO_CM_RATIO / 100;
  
  return Math.round(velocityMetersPerSec * 10) / 10;
}

function calculateLandingStability(keypoints: Keypoint[][], landingFrame: number): number {
  // Check frames around landing for stability
  const checkFrames = 5;
  let stabilityScore = 100;
  
  // Get landing position
  const landingHip = getAverageHipPosition(keypoints[landingFrame]);
  if (!landingHip) return 50;
  
  // Check subsequent frames for movement
  for (let i = 1; i <= checkFrames && landingFrame + i < keypoints.length; i++) {
    const currentHip = getAverageHipPosition(keypoints[landingFrame + i]);
    if (!currentHip) continue;
    
    const movement = Math.sqrt(
      Math.pow(currentHip.x - landingHip.x, 2) +
      Math.pow(currentHip.y - landingHip.y, 2)
    );
    
    // Penalize for excessive movement
    if (movement > 20) {
      stabilityScore -= 10;
    }
  }
  
  // Check knee angles for proper landing form
  const landingKneeAngle = calculateKneeAngle(keypoints[landingFrame]);
  if (landingKneeAngle > 160) {
    // Knees too straight, risky landing
    stabilityScore -= 20;
  }
  
  return Math.max(0, stabilityScore);
}

function calculateAngleBetweenVectors(v1: {x: number, y: number}, v2: {x: number, y: number}): number {
  const dotProduct = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosAngle = dotProduct / (mag1 * mag2);
  const angleRadians = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  const angleDegrees = angleRadians * (180 / Math.PI);
  
  return angleDegrees;
}

function calculateOverallScore(metrics: Omit<JumpMetrics, 'overallScore'>): number {
  let score = 0;
  
  // Jump height contribution (40% weight)
  // Based on the data: Below Average: <35cm, Average: 35-40cm, Good: 40-45cm, Excellent: >45cm
  if (metrics.jumpHeight >= 45) {
    score += 40;
  } else if (metrics.jumpHeight >= 40) {
    score += 30;
  } else if (metrics.jumpHeight >= 35) {
    score += 20;
  } else {
    score += 10;
  }
  
  // Knee bend angle contribution (20% weight)
  // Optimal: 90-110 degrees
  const kneeBendScore = Math.max(0, 20 - Math.abs(metrics.kneeBendAngle - 100) * 0.5);
  score += kneeBendScore;
  
  // Arm swing velocity contribution (15% weight)
  // Good velocity: > 2.5 m/s
  if (metrics.armSwingVelocity >= 2.5) {
    score += 15;
  } else {
    score += metrics.armSwingVelocity * 6;
  }
  
  // Hip extension contribution (10% weight)
  // Optimal: 150-180 degrees
  if (metrics.hipExtensionAngle >= 150 && metrics.hipExtensionAngle <= 180) {
    score += 10;
  } else {
    score += 5;
  }
  
  // Takeoff velocity contribution (10% weight)
  // Good velocity: > 2.0 m/s
  if (metrics.takeoffVelocity >= 2.0) {
    score += 10;
  } else {
    score += metrics.takeoffVelocity * 5;
  }
  
  // Landing stability contribution (5% weight)
  score += metrics.landingStability * 0.05;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}
