// server.js - Basic Node.js Backend for Sports Analysis App
// Run: npm init -y && npm install express multer cors uuid && node server.js

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const analysesDir = path.join(__dirname, 'analyses');

async function ensureDirectories() {
    try {
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.mkdir(analysesDir, { recursive: true });
        console.log('✅ Directories created/verified');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// In-memory storage for video processing status
const videoProcessingStatus = {};
const analysisResults = {};

// === ENDPOINTS ===

// 1. Upload video endpoint
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const videoId = uuidv4();
        const { sport, collection, userId } = req.body;

        // Store video metadata
        const videoMetadata = {
            videoId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            sport: sport || 'auto-detect',
            collection: collection || 'none',
            userId: userId || 'anonymous',
            uploadTime: new Date().toISOString(),
            status: 'processing',
            progress: 0
        };

        // Initialize processing status
        videoProcessingStatus[videoId] = {
            status: 'processing',
            progress: 0,
            startTime: Date.now()
        };

        // Save metadata to file (in production, use a database)
        await fs.writeFile(
            path.join(analysesDir, `${videoId}-metadata.json`),
            JSON.stringify(videoMetadata, null, 2)
        );

        console.log(`📹 Video uploaded: ${videoId} - ${req.file.originalname}`);

        // Start async processing (simulated)
        processVideo(videoId, videoMetadata);

        res.json({
            videoId,
            message: 'Video uploaded successfully',
            filename: req.file.originalname,
            size: req.file.size
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

// 2. Check processing status
app.get('/api/videos/:videoId/status', (req, res) => {
    const { videoId } = req.params;
    const status = videoProcessingStatus[videoId];

    if (!status) {
        return res.status(404).json({ error: 'Video not found' });
    }

    res.json(status);
});

// 3. Get analysis results
app.get('/api/analyses/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const results = analysisResults[videoId];

    if (!results) {
        // Try to load from file
        try {
            const data = await fs.readFile(
                path.join(analysesDir, `${videoId}-analysis.json`),
                'utf-8'
            );
            res.json(JSON.parse(data));
        } catch (error) {
            res.status(404).json({ error: 'Analysis not found' });
        }
        return;
    }

    res.json(results);
});

// 4. List all videos for a user
app.get('/api/users/:userId/videos', async (req, res) => {
    try {
        const files = await fs.readdir(analysesDir);
        const metadataFiles = files.filter(f => f.endsWith('-metadata.json'));
        
        const videos = [];
        for (const file of metadataFiles) {
            const data = await fs.readFile(path.join(analysesDir, file), 'utf-8');
            const metadata = JSON.parse(data);
            if (metadata.userId === req.params.userId) {
                videos.push(metadata);
            }
        }

        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// === SIMULATED VIDEO PROCESSING ===

async function processVideo(videoId, metadata) {
    console.log(`🔄 Starting processing for video: ${videoId}`);

    // Simulate different processing stages
    const stages = [
        { name: 'Extracting frames', duration: 2000, progress: 20 },
        { name: 'Running pose estimation', duration: 3000, progress: 50 },
        { name: 'Analyzing movement', duration: 2000, progress: 70 },
        { name: 'Generating feedback', duration: 1000, progress: 90 },
        { name: 'Finalizing', duration: 500, progress: 100 }
    ];

    for (const stage of stages) {
        // Update status
        videoProcessingStatus[videoId] = {
            status: 'processing',
            progress: stage.progress,
            currentStage: stage.name,
            startTime: videoProcessingStatus[videoId].startTime
        };

        console.log(`  ⚙️  ${stage.name} (${stage.progress}%)`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, stage.duration));
    }

    // Generate simulated analysis results
    const analysis = generateMockAnalysis(metadata);

    // Store results
    analysisResults[videoId] = analysis;
    await fs.writeFile(
        path.join(analysesDir, `${videoId}-analysis.json`),
        JSON.stringify(analysis, null, 2)
    );

    // Update status to completed
    videoProcessingStatus[videoId] = {
        status: 'completed',
        progress: 100,
        completedTime: Date.now()
    };

    console.log(`✅ Processing completed for video: ${videoId}`);
}

function generateMockAnalysis(metadata) {
    // Simulate different sports and generate appropriate feedback
    const sportsFeedback = {
        golf: [
            {
                icon: '⚠️',
                title: 'Hip Rotation',
                description: 'Your hip rotation is starting late in the downswing. Try initiating the hip turn slightly before your arms start moving down.',
                type: 'improvement'
            },
            {
                icon: '✅',
                title: 'Spine Angle',
                description: 'Excellent maintenance of spine angle throughout the swing.',
                type: 'success'
            },
            {
                icon: '💡',
                title: 'Weight Transfer',
                description: 'Focus on shifting more weight to your front foot during impact.',
                type: 'tip'
            }
        ],
        tennis: [
            {
                icon: '⚠️',
                title: 'Ball Toss',
                description: 'Your toss is slightly behind your head. Try tossing more in front.',
                type: 'improvement'
            },
            {
                icon: '✅',
                title: 'Follow Through',
                description: 'Great extension and follow through after contact.',
                type: 'success'
            }
        ],
        default: [
            {
                icon: '💡',
                title: 'Form Analysis',
                description: 'Movement pattern detected and analyzed successfully.',
                type: 'info'
            }
        ]
    };

    const sport = metadata.sport === 'auto-detect' ? 'golf' : metadata.sport;
    const feedback = sportsFeedback[sport] || sportsFeedback.default;
    const formScore = Math.floor(Math.random() * 20) + 70; // 70-90 range

    return {
        videoId: metadata.videoId,
        sportType: sport.charAt(0).toUpperCase() + sport.slice(1),
        formScore: formScore,
        analysisDate: new Date().toISOString(),
        duration: 3.2,
        feedback: feedback,
        poseData: {
            frameCount: 96,
            keypoints: generateMockKeypoints(),
            phases: ['Setup', 'Backswing', 'Top', 'Impact', 'Follow-through']
        },
        recommendations: [
            'Practice hip rotation drills',
            'Work on weight transfer exercises',
            'Record weekly to track progress'
        ],
        comparisonData: {
            proAverage: 85,
            userScore: formScore,
            improvement: '+5% from last session'
        }
    };
}

function generateMockKeypoints() {
    // Generate simplified mock keypoint data for 5 key frames
    const keyframes = [];
    for (let i = 0; i < 5; i++) {
        keyframes.push({
            frame: i * 20,
            timestamp: i * 0.8,
            joints: {
                head: { x: 0.5, y: 0.2 + (i * 0.01), confidence: 0.98 },
                leftShoulder: { x: 0.4, y: 0.35, confidence: 0.95 },
                rightShoulder: { x: 0.6, y: 0.35, confidence: 0.95 },
                leftHip: { x: 0.45, y: 0.6, confidence: 0.92 },
                rightHip: { x: 0.55, y: 0.6, confidence: 0.92 }
                // ... additional joints would be here
            }
        });
    }
    return keyframes;
}

// === ERROR HANDLING ===

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// === START SERVER ===

app.listen(PORT, () => {
    console.log(`
    🚀 Sports Analysis Backend Server Running
    =======================================
    Server: http://localhost:${PORT}
    
    Endpoints:
    - POST   /api/videos/upload          - Upload video for analysis
    - GET    /api/videos/:videoId/status - Check processing status
    - GET    /api/analyses/:videoId      - Get analysis results
    - GET    /api/users/:userId/videos   - List user's videos
    
    📁 Videos saved to: ${uploadsDir}
    📊 Analyses saved to: ${analysesDir}
    
    Note: This is a mock backend for demo purposes.
    Real implementation would include:
    - Actual pose estimation (MediaPipe/OpenPose)
    - Cloud storage (AWS S3)
    - Database (PostgreSQL/MongoDB)
    - GPU processing for ML models
    - WebSocket for real-time updates
    `);
});