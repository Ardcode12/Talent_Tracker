import { Request, Response } from 'express';
import Video, { IVideo } from '../models/Video';
import fs from 'fs';
import path from 'path';
import { VideoValidator } from '../ai/videoValidator';
import { JumpDataset } from '../ai/training/jumpDataset';

// Mock AI analysis function (replace with real AI later)
async function analyzeJumpWithAI(videoPath: string): Promise<any> {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Generate realistic jump metrics
  const simulatedHeight = Math.floor(Math.random() * (60 - 25) + 25); // 25-60 cm range
  const overallScore = Math.floor(Math.random() * (100 - 50) + 50); // 50-100 score range
  
  // Generate strengths based on score
  const strengths = [];
  if (overallScore > 70) {
    strengths.push('Excellent knee bend depth for power generation');
    strengths.push('Good arm swing coordination');
  }
  if (simulatedHeight > 40) {
    strengths.push('Strong explosive power in takeoff phase');
  }
  strengths.push('Stable landing technique');
  
  // Generate improvements
  const improvements = [];
  if (overallScore < 80) {
    improvements.push('Increase arm swing velocity for better momentum');
  }
  if (simulatedHeight < 45) {
    improvements.push('Focus on deeper knee bend in preparation phase');
    improvements.push('Work on ankle flexibility for better push-off');
  }
  improvements.push('Practice maintaining upright torso during jump');
  
  const analysis = {
    jumpHeight: simulatedHeight,
    strengths,
    improvements,
    score: overallScore,
    analyzedAt: new Date(),
    modelVersion: '1.0.0',
  };
  
  return analysis;
}

export const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No video file uploaded',
      });
      return;
    }

    console.log('Received file:', req.file);
    console.log('Body:', req.body);

    // Validate video file
    const validation = await VideoValidator.validateVideo(req.file.path);
    if (!validation.isValid) {
      // Delete invalid file
      fs.unlinkSync(req.file.path);
      res.status(400).json({
        success: false,
        error: 'Invalid video file',
        issues: validation.issues,
      });
      return;
    }

    // Create video document
    const video = new Video({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      metadata: {
        athleteName: req.body.athleteName || 'Unknown Athlete',
      },
      validation: {
        isValid: validation.isValid,
        confidence: validation.confidence,
        issues: validation.issues,
        validatedAt: new Date(),
      },
    });

    await video.save();

    // Start AI analysis in background
    analyzeJumpWithAI(req.file.path)
      .then(async (analysisResult) => {
        // Compare with dataset
        const datasetComparison = await JumpDataset.compareToDataset(analysisResult);
        
        video.analysis = analysisResult;
        await video.save();
        console.log('Analysis completed for video:', video._id);
      })
      .catch((error) => {
        console.error('Analysis failed:', error);
      });

    res.json({
      success: true,
      message: 'Video uploaded successfully. Analysis in progress.',
      video: {
        id: video._id,
        filename: video.filename,
        originalName: video.originalName,
        uploadDate: video.uploadDate,
        url: `/uploads/${video.filename}`,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message,
    });
  }
};

export const getAllVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await Video.find()
      .sort({ uploadDate: -1 })
      .select('-path'); // Exclude file path from response
    
    res.json({
      success: true,
      count: videos.length,
      videos: videos.map((video) => ({
        id: video._id,
        filename: video.filename,
        originalName: video.originalName,
        uploadDate: video.uploadDate,
        size: video.size,
        analysis: video.analysis,
        validation: video.validation,
        metadata: video.metadata,
        url: `/uploads/${video.filename}`,
      })),
    });
  } catch (error: any) {
    console.error('Get videos error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos',
      details: error.message,
    });
  }
};

export const getVideoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }
    
    res.json({
      success: true,
      video: {
        id: video._id,
        filename: video.filename,
        originalName: video.originalName,
        uploadDate: video.uploadDate,
        size: video.size,
        analysis: video.analysis,
        validation: video.validation,
        metadata: video.metadata,
        feedback: video.feedback,
        calibration: video.calibration,
        url: `/uploads/${video.filename}`,
      },
    });
  } catch (error: any) {
    console.error('Get video error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video',
      details: error.message,
    });
  }
};

export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }
    
    // Delete file from filesystem
    const filePath = path.join(__dirname, '../../uploads', video.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    await video.deleteOne();
    
    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete video error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video',
      details: error.message,
    });
  }
};

export const updateAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { strengths, improvements, jumpHeight } = req.body;
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }
    
    // Update analysis
    if (video.analysis) {
      if (strengths) video.analysis.strengths = strengths;
      if (improvements) video.analysis.improvements = improvements;
      if (jumpHeight !== undefined) video.analysis.jumpHeight = jumpHeight;
      video.analysis.analyzedAt = new Date();
    } else {
      video.analysis = {
        strengths: strengths || [],
        improvements: improvements || [],
        jumpHeight: jumpHeight || 0,
        analyzedAt: new Date(),
      };
    }
    
    await video.save();
    
    res.json({
      success: true,
      message: 'Analysis updated successfully',
      analysis: video.analysis,
    });
  } catch (error: any) {
    console.error('Update analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update analysis',
      details: error.message,
    });
  }
};

export const reanalyzeVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }
    
    // Re-run AI analysis
    const newAnalysis = await analyzeJumpWithAI(video.path);
    
    // Update with new analysis
    video.analysis = {
      jumpHeight: newAnalysis.jumpHeight,
      strengths: newAnalysis.strengths,
      improvements: newAnalysis.improvements,
      score: newAnalysis.score,
      analyzedAt: new Date(),
      modelVersion: '1.0.1',
    };
    
    // Revalidate video
    const validation = await VideoValidator.validateVideo(video.path);
    video.validation = {
      isValid: validation.isValid,
      confidence: validation.confidence,
      issues: validation.issues,
      validatedAt: new Date(),
    };
    
    await video.save();
    
    res.json({
      success: true,
      message: 'Video re-analyzed successfully',
      video: {
        id: video._id,
        filename: video.filename,
        analysis: video.analysis,
        validation: video.validation,
      },
    });
  } catch (error: any) {
    console.error('Re-analyze error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-analyze video',
      details: error.message,
    });
  }
};
