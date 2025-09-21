
// src/controllers/feedbackController.ts
import { Request, Response } from 'express';
import Video from '../models/Video';
import { retrainModel } from '../ai/modelRetraining';

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { accuracyRating, comments, correctJumpHeight } = req.body;
    
    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        feedback: {
          accuracyRating,
          comments,
          correctJumpHeight,
          submittedAt: new Date(),
        },
      },
      { new: true }
    );
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Trigger retraining if we have enough feedback
    const feedbackCount = await Video.countDocuments({
      'feedback.accuracyRating': { $exists: true }
    });
    
    if (feedbackCount >= 50 && feedbackCount % 50 === 0) {
      // Retrain model with new data in background
      retrainModel().catch(console.error);
    }
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

export const getAnalyticsData = async (req: Request, res: Response) => {
  try {
    const analytics = await Video.aggregate([
      {
        $match: {
          'analysis.score': { $exists: true },
          'feedback.accuracyRating': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgAccuracyRating: { $avg: '$feedback.accuracyRating' },
          avgScore: { $avg: '$analysis.score' },
          totalVideos: { $sum: 1 },
          avgJumpHeight: { $avg: '$analysis.jumpHeight' }
        }
      }
    ]);
    
    res.json({
      success: true,
      analytics: analytics[0] || {},
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};
