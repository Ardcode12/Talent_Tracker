// src/controllers/expertController.ts
import { Request, Response } from 'express';
import Video from '../models/Video';
import { IVideo } from '../models/Video';

// Function to update model with expert data
async function updateModelWithExpertData(video: IVideo | null): Promise<void> {
  if (!video || !video.feedback?.expertValidated) {
    return;
  }
  
  // Log expert validation for future model training
  console.log('Expert validation received for video:', video._id);
  
  // In a real implementation, this would:
  // 1. Add the expert-validated data to a training dataset
  // 2. Trigger model retraining when enough expert data is collected
  // 3. Compare AI predictions with expert ground truth
  
  // For now, we'll just log the validation
  const accuracy = video.analysis?.jumpHeight && video.feedback.correctJumpHeight
    ? Math.abs(video.analysis.jumpHeight - video.feedback.correctJumpHeight)
    : null;
    
  if (accuracy !== null) {
    console.log(`AI prediction accuracy: ${accuracy}cm difference from expert measurement`);
  }
}

export const submitExpertValidation = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { 
      validatedJumpHeight, 
      validatedTechnique, 
      expertNotes,
      expertId 
    } = req.body;
    
    // First, update the Video model schema to include these new fields
    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        $set: {
          'feedback.expertValidated': true,
          'feedback.correctJumpHeight': validatedJumpHeight,
          'feedback.validatedTechnique': validatedTechnique,
          'feedback.expertNotes': expertNotes,
          'feedback.expertId': expertId,
          'feedback.validatedAt': new Date()
        }
      },
      { new: true }
    );
    
    if (!video) {
      return res.status(404).json({ 
        success: false,
        error: 'Video not found' 
      });
    }
    
    // Use expert data to improve model
    await updateModelWithExpertData(video);
    
    res.json({
      success: true,
      message: 'Expert validation submitted successfully',
      video: {
        id: video._id,
        expertValidation: {
          jumpHeight: validatedJumpHeight,
          technique: validatedTechnique,
          notes: expertNotes,
          validatedAt: video.feedback?.validatedAt
        }
      }
    });
  } catch (error) {
    console.error('Expert validation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all videos pending expert validation
export const getPendingValidations = async (req: Request, res: Response) => {
  try {
    const pendingVideos = await Video.find({
      'analysis.score': { $exists: true },
      'feedback.expertValidated': { $ne: true }
    })
    .select('filename uploadDate analysis.score analysis.jumpHeight metadata.athleteName')
    .sort({ uploadDate: -1 })
    .limit(20);
    
    res.json({
      success: true,
      count: pendingVideos.length,
      videos: pendingVideos.map(video => ({
        id: video._id,
        filename: video.filename,
        uploadDate: video.uploadDate,
        aiScore: video.analysis?.score,
        aiJumpHeight: video.analysis?.jumpHeight,
        athleteName: video.metadata?.athleteName || 'Unknown',
        url: `http://localhost:5000/uploads/${video.filename}`
      }))
    });
  } catch (error) {
    console.error('Get pending validations error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch pending validations' 
    });
  }
};

// Get expert validation statistics
export const getValidationStats = async (req: Request, res: Response) => {
  try {
    const stats = await Video.aggregate([
      {
        $match: {
          'feedback.expertValidated': true
        }
      },
      {
        $group: {
          _id: null,
          totalValidated: { $sum: 1 },
          avgDifference: {
            $avg: {
              $abs: {
                $subtract: ['$analysis.jumpHeight', '$feedback.correctJumpHeight']
              }
            }
          },
          avgAIScore: { $avg: '$analysis.score' },
          avgExpertJumpHeight: { $avg: '$feedback.correctJumpHeight' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalValidated: 0,
      avgDifference: 0,
      avgAIScore: 0,
      avgExpertJumpHeight: 0
    };
    
    res.json({
      success: true,
      statistics: {
        totalValidatedVideos: result.totalValidated,
        averageAccuracyDifference: result.avgDifference?.toFixed(2) || '0',
        averageAIScore: result.avgAIScore?.toFixed(1) || '0',
        averageExpertJumpHeight: result.avgExpertJumpHeight?.toFixed(1) || '0'
      }
    });
  } catch (error) {
    console.error('Get validation stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch validation statistics' 
    });
  }
};

// Submit batch expert validations
export const submitBatchValidations = async (req: Request, res: Response) => {
  try {
    const { validations, expertId } = req.body;
    
    if (!Array.isArray(validations)) {
      return res.status(400).json({
        success: false,
        error: 'Validations must be an array'
      });
    }
    
    const results = [];
    
    for (const validation of validations) {
      try {
        const video = await Video.findByIdAndUpdate(
          validation.videoId,
          {
            $set: {
              'feedback.expertValidated': true,
              'feedback.correctJumpHeight': validation.jumpHeight,
              'feedback.validatedTechnique': validation.technique,
              'feedback.expertNotes': validation.notes,
              'feedback.expertId': expertId,
              'feedback.validatedAt': new Date()
            }
          },
          { new: true }
        );
        
        if (video) {
          await updateModelWithExpertData(video);
          results.push({
            videoId: video._id,
            success: true
          });
        } else {
          results.push({
            videoId: validation.videoId,
            success: false,
            error: 'Video not found'
          });
        }
      } catch (error) {
        results.push({
          videoId: validation.videoId,
          success: false,
          error: 'Update failed'
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Batch validation completed',
      results
    });
  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Batch validation failed' 
    });
  }
};
