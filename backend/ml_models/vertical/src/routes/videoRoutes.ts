
import express from 'express';
import { upload } from '../middleware/upload';
import {
  uploadVideo,
  getAllVideos,
  getVideoById,
  deleteVideo,
  updateAnalysis,
  reanalyzeVideo, // Add this import
} from '../controllers/videoController';

const router = express.Router();

// Routes
router.post('/upload', upload.single('video'), uploadVideo);
router.get('/', getAllVideos);
router.get('/:id', getVideoById);
router.delete('/:id', deleteVideo);
router.put('/:id/analysis', updateAnalysis);
router.post('/:id/reanalyze', reanalyzeVideo); // Add re-analyze route

export default router;
