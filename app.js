const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const axios = require('axios');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

// Import models and services
const { Intersection, TrafficData, SignalTiming, ActivityLog, WeatherData, Prediction } = require('./models/Traffic');
const { CameraFeed, CameraEvent, CameraData } = require('./models/Camera');
const RealTrafficService = require('./services/RealTrafficService');
const RealCameraService = require('./services/RealCameraService');
const { seedDatabase } = require('./seeders/seedDatabase');
const { seedCameras, generateSampleCameraData } = require('./seeders/seedCameras');

// Import routes
const cameraRoutes = require('./routes/cameraRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_management';

// Initialize services
const realTrafficService = new RealTrafficService();
const realCameraService = new RealCameraService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Seed database with initial data if empty
    const intersectionCount = await Intersection.countDocuments();
    const cameraCount = await CameraFeed.countDocuments();
    
    // Skip automatic seeding to avoid validation errors
    if (intersectionCount === 0 && cameraCount === 0) {
      console.log('📊 Database is empty. Run manual seeding if needed.');
      console.log('💡 Use: node seeders/seedRealCameras.js && node seeders/seedDatabase.js');
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Setup real-time traffic data updates
function setupRealTimeUpdates() {
  // Update traffic data every 2 minutes
  const updateInterval = process.env.TRAFFIC_UPDATE_INTERVAL || 2;
  cron.schedule(`*/${updateInterval} * * * *`, async () => {
    try {
      console.log('🔄 Updating real-time traffic data...');
      await updateRealTimeTrafficData();
      console.log('✅ Real-time traffic data updated');
    } catch (error) {
      console.error('❌ Error updating real-time traffic data:', error.message);
    }
  });

  // Schedule real camera data updates every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('📹 Fetching real camera data from APIs...');
      const updatedCount = await realCameraService.updateAllCamerasWithRealData();
      console.log(`✅ Updated ${updatedCount} cameras with real data`);
      
      // Emit real camera updates to clients
      io.emit('realCameraUpdate', {
        timestamp: new Date(),
        updatedCameras: updatedCount,
        source: 'real_apis'
      });
    } catch (error) {
      console.error('❌ Error updating real camera data:', error.message);
    }
  });

  // Schedule real-time camera analytics every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    try {
      console.log('📊 Updating real-time camera analytics...');
      await updateRealCameraAnalytics();
      console.log('✅ Real camera analytics updated');
    } catch (error) {
      console.error('❌ Error updating real camera analytics:', error.message);
    }
  });

  // Schedule camera health checks every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🏥 Running camera health checks...');
      await simulateCameraHealthUpdates();
      console.log('✅ Camera health checks completed');
    } catch (error) {
      console.error('❌ Error running camera health checks:', error.message);
    }
  });
  
  console.log('⏰ Scheduled real-time updates every 2 minutes');
  console.log('📹 Scheduled camera updates every 5 minutes');
  console.log('🔍 Scheduled camera health checks every 5 minutes');
}

// Get latest traffic data for all intersections
async function getLatestTrafficData() {
  try {
    const intersections = await Intersection.find({ status: 'active' });
    const latestData = [];
    
    for (const intersection of intersections) {
      const latest = await TrafficData.findOne({ 
        intersection_id: intersection.id 
      }).sort({ timestamp: -1 });
      
      if (latest) {
        latestData.push({
          intersection_id: intersection.id,
          name: intersection.name,
          ...latest.toObject()
        });
      }
    }
    
    return latestData;
  } catch (error) {
    console.error('Error getting latest traffic data:', error);
    return [];
  }
}

// Routes

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Use camera routes
app.use('/api/cameras', cameraRoutes);

// API Routes

// Get all intersections
app.get('/api/intersections', async (req, res) => {
  try {
    const intersections = await Intersection.find({ status: 'active' }).select('-__v');
    res.json({ success: true, data: intersections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get traffic data for intersection
app.get('/api/traffic/:intersectionId', async (req, res) => {
  try {
    const { intersectionId } = req.params;
    const trafficData = await TrafficData.find({ intersection_id: intersectionId })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('-__v');
    
    res.json({ success: true, data: trafficData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post new traffic data
app.post('/api/traffic', async (req, res) => {
  try {
    const { intersection_id, vehicle_count, avg_speed, congestion_level } = req.body;
    
    const trafficData = new TrafficData({
      intersection_id,
      vehicle_count,
      avg_speed,
      congestion_level,
      data_source: 'manual',
      timestamp: new Date()
    });
    
    await trafficData.save();
    
    // Log activity
    await logActivity('Traffic Data Updated', intersection_id, `${vehicle_count} vehicles detected`);
    
    // Emit real-time update
    io.emit('traffic-update', {
      intersection_id,
      vehicle_count,
      avg_speed,
      congestion_level,
      timestamp: new Date()
    });
    
    res.json({ success: true, id: trafficData._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AI optimization for intersection
app.get('/api/optimize/:intersectionId', async (req, res) => {
  try {
    const { intersectionId } = req.params;
    
    // Get recent traffic data from MongoDB
    const trafficData = await TrafficData.findOne({ 
      intersection_id: intersectionId 
    }).sort({ timestamp: -1 });

    if (!trafficData) {
      const defaultOptimization = {
        green_time: 45,
        yellow_time: 3,
        red_time: 30,
        confidence: 0.5,
        source: 'default',
        reasoning: 'No traffic data available, using default timing'
      };
      
      return res.json({
        success: true,
        data: defaultOptimization
      });
    }

    // Try to call AI service for optimization
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/optimize`, {
        intersection_id: intersectionId,
        traffic_data: trafficData
      }, { timeout: 5000 });
      
      // Save optimization to database
      const signalTiming = new SignalTiming({
        intersection_id: intersectionId,
        phase_name: 'AI Optimized',
        green_time: aiResponse.data.green_time,
        yellow_time: aiResponse.data.yellow_time,
        red_time: aiResponse.data.red_time,
        is_ai_optimized: true,
        optimization_confidence: aiResponse.data.confidence,
        optimization_reason: aiResponse.data.reasoning,
        is_active: true
      });
      
      await signalTiming.save();
      
      // Log activity
      await logActivity('AI Optimization Applied', intersectionId, 
        `Green: ${aiResponse.data.green_time}s, Confidence: ${Math.round(aiResponse.data.confidence * 100)}%`);
      
      res.json({ success: true, data: aiResponse.data });
      
    } catch (aiError) {
      console.log('AI service unavailable, using rule-based optimization');
      
      // Fallback to rule-based optimization
      const optimization = optimizeTrafficRules(trafficData);
      
      // Save optimization to database
      const signalTiming = new SignalTiming({
        intersection_id: intersectionId,
        phase_name: 'Rule-based',
        green_time: optimization.green_time,
        yellow_time: optimization.yellow_time,
        red_time: optimization.red_time,
        is_ai_optimized: false,
        optimization_confidence: optimization.confidence,
        optimization_reason: optimization.reasoning,
        is_active: true
      });
      
      await signalTiming.save();
      
      // Log activity
      await logActivity('Rule-based Optimization Applied', intersectionId, 
        `Green: ${optimization.green_time}s (AI service offline)`);
      
      res.json({ success: true, data: optimization });
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process camera image for vehicle detection
app.post('/api/detect', async (req, res) => {
  try {
    const { intersection_id, image_data } = req.body;
    
    if (!intersection_id) {
      return res.status(400).json({ error: 'intersection_id required' });
    }
    
    // Try to call AI service for vehicle detection
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/detect`, {
        intersection_id,
        image_data
      }, { timeout: 5000 });
      
      // Store the results
      const { vehicle_count, avg_speed, congestion_level } = aiResponse.data;
      
      db.run(`
        INSERT INTO traffic_data (intersection_id, vehicle_count, avg_speed, congestion_level)
        VALUES (?, ?, ?, ?)
      `, [intersection_id, vehicle_count, avg_speed, congestion_level]);
      
      // Log activity
      logActivity('AI Vehicle Detection', intersection_id, 
        `${vehicle_count} vehicles detected with ${Math.round(aiResponse.data.confidence * 100)}% confidence`);
      
      // Emit real-time update
      io.emit('traffic-update', {
        intersection_id,
        vehicle_count,
        avg_speed,
        congestion_level,
        timestamp: new Date()
      });
      
      res.json({ success: true, data: aiResponse.data });
      
    } catch (aiError) {
      console.log('AI service unavailable, using mock detection');
      
      // Fallback to mock detection
      const mockData = generateMockTrafficData();
      
      // Store mock data
      db.run(`
        INSERT INTO traffic_data (intersection_id, vehicle_count, avg_speed, congestion_level)
        VALUES (?, ?, ?, ?)
      `, [intersection_id, mockData.vehicle_count, mockData.avg_speed, mockData.congestion_level]);
      
      // Log activity
      logActivity('Mock Vehicle Detection', intersection_id, 
        `${mockData.vehicle_count} vehicles detected (AI service offline)`);
      
      // Emit real-time update
      io.emit('traffic-update', {
        intersection_id,
        vehicle_count: mockData.vehicle_count,
        avg_speed: mockData.avg_speed,
        congestion_level: mockData.congestion_level,
        timestamp: new Date()
      });
      
      res.json({ success: true, data: mockData });
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard summary
app.get('/api/dashboard', async (req, res) => {
  try {
    const intersections = await Intersection.find({ status: 'active' });
    const intersectionData = [];
    
    // Get latest traffic data for each intersection
    for (const intersection of intersections) {
      const latestTraffic = await TrafficData.findOne({ 
        intersection_id: intersection.id,
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      }).sort({ timestamp: -1 });
      
      intersectionData.push({
        id: intersection.id,
        name: intersection.name,
        latitude: intersection.location.latitude,
        longitude: intersection.location.longitude,
        vehicle_count: latestTraffic?.vehicle_count || 0,
        avg_speed: latestTraffic?.avg_speed || 0,
        congestion_level: latestTraffic?.congestion_level || 0,
        timestamp: latestTraffic?.timestamp,
        data_source: latestTraffic?.data_source,
        weather_condition: latestTraffic?.weather_condition
      });
    }
    
    const summary = {
      total_intersections: intersectionData.length,
      total_vehicles: intersectionData.reduce((sum, row) => sum + (row.vehicle_count || 0), 0),
      avg_speed: intersectionData.length > 0 ? 
        Math.round(intersectionData.reduce((sum, row) => sum + (row.avg_speed || 0), 0) / intersectionData.length) : 0,
      high_congestion: intersectionData.filter(row => (row.congestion_level || 0) > 1).length,
      real_data_sources: intersectionData.filter(row => row.data_source === 'api').length
    };
    
    res.json({ success: true, summary, intersections: intersectionData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activity
app.get('/api/activity', async (req, res) => {
  try {
    const activities = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('intersection_id', 'name')
      .select('-__v');
    
    // Add intersection names
    const activitiesWithNames = await Promise.all(
      activities.map(async (activity) => {
        let intersectionName = '';
        if (activity.intersection_id) {
          const intersection = await Intersection.findOne({ id: activity.intersection_id });
          intersectionName = intersection?.name || '';
        }
        
        return {
          ...activity.toObject(),
          intersection_name: intersectionName
        };
      })
    );
    
    res.json({ success: true, data: activitiesWithNames });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get traffic predictions
app.get('/api/predict/:intersectionId', async (req, res) => {
  const { intersectionId } = req.params;
  
  try {
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, {
      intersection_id: intersectionId,
      time_horizon: 60
    }, { timeout: 5000 });
    
    logActivity('Traffic Prediction Generated', intersectionId, 
      `${aiResponse.data.predictions.length} predictions generated`);
    
    res.json({ success: true, data: aiResponse.data });
    
  } catch (aiError) {
    // Fallback to simple prediction
    const mockPredictions = generateMockPredictions();
    
    logActivity('Mock Traffic Prediction', intersectionId, 
      'Predictions generated (AI service offline)');
    
    res.json({ 
      success: true, 
      data: {
        intersection_id: intersectionId,
        predictions: mockPredictions,
        generated_at: new Date().toISOString()
      }
    });
  }
});

// Check AI service status
app.get('/api/ai-status', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
    res.json({ success: true, status: 'online', data: response.data });
  } catch (error) {
    res.json({ success: true, status: 'offline', error: 'AI service unavailable' });
  }
});

// Get comprehensive system status
app.get('/api/system-status', async (req, res) => {
  try {
    const [intersectionCount, trafficDataCount, recentActivities, latestTrafficData] = await Promise.all([
      Intersection.countDocuments(),
      TrafficData.countDocuments(),
      ActivityLog.countDocuments({ timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      TrafficData.find().sort({ timestamp: -1 }).limit(10)
    ]);
    
    // Check AI service
    let aiStatus = 'offline';
    try {
      await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
      aiStatus = 'online';
    } catch (error) {
      // AI service is offline
    }
    
    const systemStatus = {
      server: {
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        intersections: intersectionCount,
        traffic_data_points: trafficDataCount,
        recent_activities: recentActivities
      },
      ai_service: {
        status: aiStatus,
        url: AI_SERVICE_URL
      },
      data_sources: {
        real_apis_configured: {
          tomtom: !!(process.env.TOMTOM_API_KEY && process.env.TOMTOM_API_KEY !== 'your_tomtom_api_key_here'),
          google: !!(process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here'),
          here: !!(process.env.HERE_API_KEY && process.env.HERE_API_KEY !== 'your_here_api_key_here'),
          weather: !!(process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'your_openweather_api_key_here')
        },
        latest_updates: latestTrafficData.map(data => ({
          intersection_id: data.intersection_id,
          timestamp: data.timestamp,
          source: data.data_source
        }))
      },
      performance: {
        update_interval: process.env.TRAFFIC_UPDATE_INTERVAL || 2,
        last_update: new Date().toISOString()
      }
    };
    
    res.json({ success: true, data: systemStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Force manual traffic data update
app.post('/api/force-update', async (req, res) => {
  try {
    console.log('🔄 Manual traffic data update requested');
    const updatedCount = await trafficService.updateAllIntersections();
    
    if (updatedCount > 0) {
      // Emit updates to connected clients
      const latestData = await getLatestTrafficData();
      io.emit('traffic-bulk-update', latestData);
      
      // Log activity
      await logActivity('Manual Data Update', null, `Manually updated ${updatedCount} intersections`, 'manual', 'info');
    }
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} intersections`,
      updated_count: updatedCount 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial system status
  socket.emit('system-status', {
    server_time: new Date().toISOString(),
    mongodb_connected: mongoose.connection.readyState === 1,
    ai_service_available: false, // Will be updated by health check
    real_data_enabled: !!(process.env.TOMTOM_API_KEY && process.env.TOMTOM_API_KEY !== 'your_tomtom_api_key_here')
  });
  
  socket.on('subscribe-intersection', (intersectionId) => {
    socket.join(`intersection-${intersectionId}`);
    console.log(`Client ${socket.id} subscribed to intersection ${intersectionId}`);
    
    // Send latest data for this intersection
    TrafficData.findOne({ intersection_id: intersectionId })
      .sort({ timestamp: -1 })
      .then(data => {
        if (data) {
          socket.emit('intersection-data', {
            intersection_id: intersectionId,
            ...data.toObject()
          });
        }
      });
  });
  
  socket.on('unsubscribe-intersection', (intersectionId) => {
    socket.leave(`intersection-${intersectionId}`);
    console.log(`Client ${socket.id} unsubscribed from intersection ${intersectionId}`);
  });
  
  socket.on('request-system-info', () => {
    // Send comprehensive system information
    Promise.all([
      Intersection.countDocuments(),
      TrafficData.countDocuments(),
      ActivityLog.countDocuments({ timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
    ]).then(([intersectionCount, trafficDataCount, todayActivities]) => {
      socket.emit('system-info', {
        intersections: intersectionCount,
        total_data_points: trafficDataCount,
        today_activities: todayActivities,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        api_keys_configured: {
          tomtom: !!(process.env.TOMTOM_API_KEY && process.env.TOMTOM_API_KEY !== 'your_tomtom_api_key_here'),
          google: !!(process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here'),
          here: !!(process.env.HERE_API_KEY && process.env.HERE_API_KEY !== 'your_here_api_key_here'),
          weather: !!(process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'your_openweather_api_key_here')
        }
      });
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper functions
function optimizeTrafficRules(trafficData) {
  const { vehicle_count, congestion_level, avg_speed } = trafficData;
  
  let green_time = 45;
  let red_time = 30;
  
  // Simple rule-based optimization
  if (congestion_level > 1) {
    green_time = Math.min(90, green_time + (vehicle_count * 2));
    red_time = Math.max(20, red_time - 5);
  } else if (congestion_level === 0) {
    green_time = Math.max(30, green_time - 10);
    red_time = Math.min(45, red_time + 5);
  }
  
  // Speed-based adjustments
  if (avg_speed < 20) {
    green_time += 10;
  } else if (avg_speed > 40) {
    green_time -= 5;
  }
  
  const reasoning = congestion_level > 1 ? 
    `High congestion detected (${vehicle_count} vehicles). Extended green time to improve flow.` :
    congestion_level === 1 ?
    `Moderate traffic (${vehicle_count} vehicles). Balanced timing for optimal flow.` :
    `Light traffic (${vehicle_count} vehicles). Shorter cycles to reduce wait times.`;
  
  return {
    green_time: Math.round(green_time),
    yellow_time: 3,
    red_time: Math.round(red_time),
    confidence: 0.7,
    source: 'rule-based',
    reasoning
  };
}

function generateMockTrafficData() {
  const vehicle_count = Math.floor(Math.random() * 50) + 10;
  let congestion_level, avg_speed;
  
  if (vehicle_count < 20) {
    congestion_level = 0;
    avg_speed = Math.floor(Math.random() * 15) + 35;
  } else if (vehicle_count < 35) {
    congestion_level = 1;
    avg_speed = Math.floor(Math.random() * 15) + 20;
  } else {
    congestion_level = 2;
    avg_speed = Math.floor(Math.random() * 15) + 10;
  }
  
  return {
    vehicle_count,
    avg_speed,
    congestion_level,
    confidence: 0.8,
    source: 'mock'
  };
}

function generateMockPredictions() {
  const predictions = [];
  for (let i = 0; i < 4; i++) {
    const timeOffset = (i + 1) * 15;
    const hour = new Date().getHours();
    
    let baseTraffic;
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      baseTraffic = Math.floor(Math.random() * 20) + 30;
    } else if (hour >= 10 && hour <= 16) {
      baseTraffic = Math.floor(Math.random() * 15) + 15;
    } else {
      baseTraffic = Math.floor(Math.random() * 10) + 5;
    }
    
    predictions.push({
      time_offset: timeOffset,
      predicted_vehicles: baseTraffic,
      confidence: Math.round((Math.random() * 0.3 + 0.6) * 100) / 100,
      congestion_risk: baseTraffic > 35 ? 'high' : baseTraffic > 20 ? 'medium' : 'low'
    });
  }
  return predictions;
}

async function logActivity(action, intersectionId, details, category = 'system', severity = 'info') {
  try {
    const activity = new ActivityLog({
      action,
      intersection_id: intersectionId,
      details,
      category,
      severity,
      timestamp: new Date()
    });
    await activity.save();
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Camera-specific functions
async function updateCameraAnalytics() {
  try {
    const activeCameras = await CameraFeed.find({ status: 'active' });
    let updatedCount = 0;
    
    for (const camera of activeCameras) {
      // Generate new analytics data
      const vehicleCount = Math.floor(Math.random() * 25) + 5;
      const avgSpeed = Math.floor(Math.random() * 20) + 25;
      
      // Create new camera data entry
      const cameraData = new CameraData({
        camera_id: camera.id,
        timestamp: new Date(),
        frame_data: {
          frame_number: Math.floor(Math.random() * 10000),
          timestamp: new Date(),
          quality_score: Math.random() * 0.3 + 0.7,
          brightness: Math.random() * 50 + 50,
          contrast: Math.random() * 30 + 70,
          motion_detected: Math.random() > 0.3
        },
        detections: {
          vehicles: generateVehicleDetections(vehicleCount),
          pedestrians: generatePedestrianDetections(),
          incidents: Math.random() > 0.95 ? [generateIncidentDetection()] : []
        },
        summary: {
          total_vehicles: vehicleCount,
          vehicle_types: {
            cars: Math.floor(vehicleCount * 0.7),
            trucks: Math.floor(vehicleCount * 0.15),
            buses: Math.floor(vehicleCount * 0.05),
            motorcycles: Math.floor(vehicleCount * 0.08),
            bicycles: Math.floor(vehicleCount * 0.02)
          },
          average_speed: avgSpeed,
          traffic_density: vehicleCount > 15 ? 2 : vehicleCount > 8 ? 1 : 0,
          congestion_level: vehicleCount > 15 ? 2 : vehicleCount > 8 ? 1 : 0
        }
      });
      
      await cameraData.save();
      
      // Update camera analytics
      camera.analytics.daily_vehicle_count += vehicleCount;
      camera.analytics.total_vehicles_detected += vehicleCount;
      camera.analytics.average_speed = avgSpeed;
      
      if (vehicleCount > (camera.analytics.peak_hour_traffic || 0)) {
        camera.analytics.peak_hour_traffic = vehicleCount;
      }
      
      await camera.save();
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      // Emit camera updates to connected clients
      const updatedCameras = await CameraFeed.find({ status: 'active' });
      io.emit('camera-analytics-update', {
        timestamp: new Date(),
        updated_cameras: updatedCount,
        cameras: updatedCameras
      });
      
      await logActivity('Camera Analytics Update', null, `Updated analytics for ${updatedCount} cameras`, 'system', 'info');
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Error updating camera analytics:', error);
    return 0;
  }
}

async function simulateCameraHealthChecks() {
  try {
    const cameras = await CameraFeed.find();
    let healthUpdates = 0;
    
    for (const camera of cameras) {
      // Simulate health check results
      const previousStatus = camera.status;
      const healthCheck = simulateHealthCheck(camera);
      
      // Update camera health
      camera.health = {
        ...camera.health,
        last_ping: new Date(),
        latency_ms: healthCheck.latency,
        connection_quality: healthCheck.quality,
        frame_rate_actual: healthCheck.frameRate,
        uptime_percentage: Math.max(0, camera.health.uptime_percentage + (Math.random() - 0.5) * 2)
      };
      
      // Update status based on health check
      if (healthCheck.success) {
        if (camera.status === 'error' || camera.status === 'offline') {
          camera.status = 'active';
          camera.health.error_count = 0;
          
          // Log recovery event
          const event = new CameraEvent({
            camera_id: camera.id,
            event_type: 'connection_restored',
            severity: 'info',
            description: `Camera "${camera.name}" connection restored`,
            details: { previous_status: previousStatus, latency: healthCheck.latency }
          });
          await event.save();
        }
      } else {
        camera.health.error_count += 1;
        if (camera.health.error_count > 3) {
          camera.status = 'error';
          camera.health.last_error = 'Multiple connection failures detected';
          
          // Log error event
          const event = new CameraEvent({
            camera_id: camera.id,
            event_type: 'connection_lost',
            severity: 'error',
            description: `Camera "${camera.name}" connection lost`,
            details: { error_count: camera.health.error_count, latency: healthCheck.latency }
          });
          await event.save();
        }
      }
      
      await camera.save();
      healthUpdates++;
    }
    
    if (healthUpdates > 0) {
      // Emit health updates to connected clients
      io.emit('camera-health-update', {
        timestamp: new Date(),
        checked_cameras: healthUpdates
      });
    }
    
    return healthUpdates;
  } catch (error) {
    console.error('Error in camera health simulation:', error);
    return 0;
  }
}

function simulateHealthCheck(camera) {
  // Simulate different health scenarios based on current status
  let successRate = 0.95; // Default 95% success rate
  
  if (camera.status === 'maintenance') {
    successRate = 0.1; // Low success during maintenance
  } else if (camera.status === 'error') {
    successRate = 0.3; // 30% chance of recovery
  } else if (camera.health?.error_count > 0) {
    successRate = 0.8; // Reduced success if there were previous errors
  }
  
  const success = Math.random() < successRate;
  const latency = success ? 
    Math.floor(Math.random() * 100) + 30 : 
    Math.floor(Math.random() * 300) + 200;
  
  let quality = 'excellent';
  if (latency > 150) quality = 'poor';
  else if (latency > 100) quality = 'fair';
  else if (latency > 60) quality = 'good';
  
  const frameRate = success ? 
    (camera.camera_specs?.fps || 30) - Math.floor(Math.random() * 5) :
    Math.floor(Math.random() * 15) + 5;
  
  return {
    success,
    latency,
    quality,
    frameRate
  };
}

function generateVehicleDetections(count) {
  const vehicles = [];
  const vehicleTypes = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
  
  for (let i = 0; i < count; i++) {
    vehicles.push({
      type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
      confidence: Math.random() * 0.3 + 0.7,
      bounding_box: {
        x: Math.floor(Math.random() * 800),
        y: Math.floor(Math.random() * 600),
        width: Math.floor(Math.random() * 100) + 50,
        height: Math.floor(Math.random() * 80) + 40
      },
      speed: Math.floor(Math.random() * 30) + 20,
      direction: ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)],
      license_plate: Math.random() > 0.7 ? generateLicensePlate() : null
    });
  }
  
  return vehicles;
}

function generatePedestrianDetections() {
  const pedestrianCount = Math.floor(Math.random() * 5);
  const pedestrians = [];
  
  for (let i = 0; i < pedestrianCount; i++) {
    pedestrians.push({
      confidence: Math.random() * 0.2 + 0.8,
      bounding_box: {
        x: Math.floor(Math.random() * 800),
        y: Math.floor(Math.random() * 600),
        width: Math.floor(Math.random() * 40) + 30,
        height: Math.floor(Math.random() * 60) + 80
      }
    });
  }
  
  return pedestrians;
}

function generateIncidentDetection() {
  const incidentTypes = ['accident', 'breakdown', 'congestion', 'illegal_parking'];
  return {
    type: incidentTypes[Math.floor(Math.random() * incidentTypes.length)],
    confidence: Math.random() * 0.3 + 0.7,
    location: {
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600)
    },
    severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
  };
}

function generateLicensePlate() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let plate = '';
  
  for (let i = 0; i < 3; i++) {
    plate += letters[Math.floor(Math.random() * letters.length)];
  }
  plate += '-';
  for (let i = 0; i < 4; i++) {
    plate += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  return plate;
}

// Update real-time traffic data function
async function updateRealTimeTrafficData() {
  try {
    const intersections = await Intersection.find({ status: 'active' });
    let updatedCount = 0;
    
    for (const intersection of intersections) {
      // Get real traffic data using the service
      const trafficData = await realTrafficService.getRealTrafficData(intersection.id);
      
      if (trafficData) {
        // Save to database
        const newTrafficData = new TrafficData({
          intersection_id: intersection.id,
          vehicle_count: trafficData.vehicle_count,
          avg_speed: trafficData.avg_speed,
          congestion_level: trafficData.congestion_level,
          data_source: 'real_api',
          timestamp: new Date(),
          weather_condition: trafficData.weather_condition
        });
        
        await newTrafficData.save();
        
        // Emit real-time update
        io.emit('traffic-update', {
          intersection_id: intersection.id,
          vehicle_count: trafficData.vehicle_count,
          avg_speed: trafficData.avg_speed,
          congestion_level: trafficData.congestion_level,
          timestamp: new Date(),
          data_source: 'real_api'
        });
        
        updatedCount++;
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Error updating real-time traffic data:', error);
    return 0;
  }
}

// Update real camera analytics function
async function updateRealCameraAnalytics() {
  try {
    const activeCameras = await CameraFeed.find({ status: 'active' });
    let updatedCount = 0;
    
    for (const camera of activeCameras) {
      // Get real-time analytics using the real camera service
      const analyticsData = await realCameraService.getRealTimeAnalytics(camera.id);
      
      if (analyticsData) {
        // Emit real-time camera analytics update
        io.emit('camera-analytics-update', {
          camera_id: camera.id,
          timestamp: new Date(),
          analytics: analyticsData.summary,
          detections: analyticsData.detections
        });
        
        updatedCount++;
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Error updating real camera analytics:', error);
    return 0;
  }
}

// Start server
async function startServer() {
  try {
    // Connect to MongoDB and seed if needed
    await connectMongoDB();
    
    // Setup real-time traffic updates
    setupRealTimeUpdates();
    
    // Start the server
    server.listen(PORT, () => {
      console.log('🚀 AI Traffic Management System Started');
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
      console.log(`🤖 AI Service: ${AI_SERVICE_URL} (optional)`);
      console.log(`🗄️  Database: MongoDB (${MONGODB_URI})`);
      console.log('');
      console.log('🌍 Using REAL traffic data from:');
      console.log('   • TomTom Traffic API');
      console.log('   • Google Maps API');
      console.log('   • HERE Traffic API');
      console.log('   • OpenWeather API');
      console.log('');
      console.log('💡 Configure API keys in .env file for real data');
      console.log('   Without API keys, system uses realistic mock data');
    });
    
    // Log system startup
    await logActivity('System Started', null, 'AI Traffic Management System initialized with real data sources', 'system', 'info');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();