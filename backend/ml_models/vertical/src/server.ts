import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupWebSocket } from './websocket/jumpAnalysisSocket';
// Import routes
import videoRoutes from './routes/videoRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // In production, specify your frontend URL
    methods: ['GET', 'POST']
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true,
}));

// Body parser for larger uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/videos', videoRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Vertical Jump API is running!',
    database: 'MongoDB (Local)',
    serverTime: new Date().toISOString(),
    websocket: 'Socket.IO enabled',
    endpoints: {
      upload: 'POST /api/videos/upload',
      getVideos: 'GET /api/videos',
      getVideo: 'GET /api/videos/:id',
      deleteVideo: 'DELETE /api/videos/:id'
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('frame', async (data: { frame: string, timestamp: number }) => {
    try {
      // For now, just echo back a simple analysis
      // In production, this would call your AI analysis function
      const mockAnalysis = {
        timestamp: data.timestamp,
        kneeAngle: Math.floor(Math.random() * (120 - 80) + 80),
        suggestion: 'Keep your back straight',
        isGoodForm: Math.random() > 0.5
      };
      
      socket.emit('feedback', mockAnalysis);
    } catch (error) {
      console.error('Frame analysis error:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('✅ Connected to MongoDB (Local)');
    console.log('📁 Database: verticalJumpDB');
    
    // IMPORTANT: Listen on all network interfaces (0.0.0.0)
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📱 For mobile access, use: http://192.168.43.93:${PORT}`);
      console.log(`🔌 WebSocket server ready on http://192.168.43.93:${PORT}`);
      console.log(`💻 Local access: http://localhost:${PORT}`);
      console.log('🔍 To find your IP, run: ipconfig');
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });
