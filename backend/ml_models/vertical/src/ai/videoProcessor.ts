import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';
import * as posenet from '@tensorflow-models/posenet';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Keypoint } from './types';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

interface Pose {
  keypoints: Keypoint[];
  score: number;
}

export async function extractKeypoints(videoPath: string): Promise<Keypoint[][]> {
  const frames = await extractFrames(videoPath);
  const poseDetector = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: { width: 640, height: 480 },
    multiplier: 0.75
  });
  
  const allKeypoints: Keypoint[][] = [];
  
  for (const frame of frames) {
    const pose = await poseDetector.estimateSinglePose(frame);
    allKeypoints.push(pose.keypoints);
    
    // Dispose of the tensor to free memory
    frame.dispose();
  }
  
  return allKeypoints;
}

async function extractFrames(videoPath: string): Promise<tf.Tensor3D[]> {
  const tempDir = path.join(__dirname, '../../temp/frames');
  
  // Ensure temp directory exists
  try {
    await mkdir(tempDir, { recursive: true });
  } catch (err) {
    console.log('Temp directory already exists or error creating:', err);
  }

  return new Promise((resolve, reject) => {
    const frameFiles: string[] = [];
    let frameCount = 0;
    
    // First, extract frames as images
    ffmpeg(videoPath)
      .fps(10) // Extract 10 frames per second (adjust based on video length)
      .on('filenames', (filenames) => {
        console.log(`Extracting ${filenames.length} frames...`);
      })
      .on('end', async () => {
        try {
          console.log('Frame extraction complete');
          
          // Read all frame files
          const files = await readdir(tempDir);
          const frameImages = files
            .filter(file => file.startsWith('frame-') && file.endsWith('.png'))
            .sort((a, b) => {
              const numA = parseInt(a.match(/frame-(\d+)\.png/)?.[1] || '0');
              const numB = parseInt(b.match(/frame-(\d+)\.png/)?.[1] || '0');
              return numA - numB;
            });

          // Convert frames to tensors
          const tensors: tf.Tensor3D[] = [];
          
          for (const filename of frameImages) {
            const filepath = path.join(tempDir, filename);
            
            try {
              // Read image and get metadata
              const image = sharp(filepath);
              const metadata = await image.metadata();
              const { width, height } = metadata;
              
              if (!width || !height) {
                console.error(`Invalid image dimensions for ${filename}`);
                continue;
              }
              
              // Convert to raw pixel data
              const { data, info } = await image
                .raw()
                .toBuffer({ resolveWithObject: true });
              
              // Create tensor from buffer
              const tensor = tf.tensor3d(
                new Uint8Array(data), 
                [info.height, info.width, info.channels]
              );
              
              // Normalize pixel values to 0-1 range
              const normalizedTensor = tensor.div(255.0);
              
              tensors.push(normalizedTensor as tf.Tensor3D);
              
              // Clean up the frame file
              await unlink(filepath);
            } catch (err) {
              console.error(`Error processing frame ${filename}:`, err);
            }
          }
          
          if (tensors.length === 0) {
            reject(new Error('No frames could be processed'));
          } else {
            console.log(`Successfully processed ${tensors.length} frames`);
            resolve(tensors);
          }
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .screenshots({
        folder: tempDir,
        filename: 'frame-%04d.png',
        size: '640x480' // Standardize frame size
      });
  });
}

// Helper function to clean up temp directory
export async function cleanupTempFrames(): Promise<void> {
  const tempDir = path.join(__dirname, '../../temp/frames');
  
  try {
    const files = await readdir(tempDir);
    
    for (const file of files) {
      if (file.startsWith('frame-') && file.endsWith('.png')) {
        await unlink(path.join(tempDir, file));
      }
    }
  } catch (err) {
    console.error('Error cleaning up temp frames:', err);
  }
}

// Alternative simpler implementation using video screenshots
export async function extractKeyFrames(videoPath: string, numFrames: number = 10): Promise<string[]> {
  const tempDir = path.join(__dirname, '../../temp/frames');
  
  // Ensure temp directory exists
  try {
    await mkdir(tempDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  return new Promise((resolve, reject) => {
    const framePaths: string[] = [];
    
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration || 10;
      const interval = duration / numFrames;
      
      // Extract frames at intervals
      const timestamps: number[] = [];
      for (let i = 0; i < numFrames; i++) {
        timestamps.push(i * interval);
      }
      
      let completed = 0;
      
      timestamps.forEach((timestamp, index) => {
        const outputPath = path.join(tempDir, `frame-${index.toString().padStart(4, '0')}.png`);
        
        ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .size('640x480')
          .output(outputPath)
          .on('end', () => {
            framePaths[index] = outputPath;
            completed++;
            
            if (completed === timestamps.length) {
              resolve(framePaths.filter(p => p)); // Filter out any undefined paths
            }
          })
          .on('error', (err) => {
            console.error(`Error extracting frame at ${timestamp}s:`, err);
            completed++;
            
            if (completed === timestamps.length) {
              resolve(framePaths.filter(p => p));
            }
          })
          .run();
      });
    });
  });
}

// Export the preprocessVideo function that was missing
export async function preprocessVideo(videoPath: string): Promise<void> {
  // Placeholder for video preprocessing
  console.log('Preprocessing video:', videoPath);
  // Add any video preprocessing logic here
  // For example: format conversion, resolution adjustment, etc.
}
