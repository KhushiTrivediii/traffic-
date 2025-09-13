# 🚦 AI Traffic Management System with Camera Feed Integration

A comprehensive real-time traffic management system featuring AI-powered analytics, camera feed management, live video monitoring, and intelligent maintenance scheduling.

## 🌟 Features

### 🚗 Traffic Management
- **Real-time Traffic Monitoring**: Live traffic data from multiple intersections
- **AI-Powered Analytics**: Intelligent traffic flow optimization and predictions
- **Interactive Dashboard**: Comprehensive web-based control panel
- **Data Visualization**: Real-time charts and graphs for traffic patterns
- **Alert System**: Automated notifications for traffic incidents and congestion

### 📹 Camera Feed Management
- **Live Camera Feeds**: Real-time video monitoring with AI detection overlays
- **Camera Health Monitoring**: Continuous status tracking and performance metrics
- **AI Detection Features**: Vehicle, pedestrian, speed, and incident detection
- **PTZ Camera Controls**: Pan, tilt, zoom functionality for supported cameras
- **Stream Quality Management**: Multiple quality settings (4K, 1080p, 720p, 480p)
- **Snapshot & Recording**: Capture images and record video segments

### 🔧 Maintenance System
- **Scheduled Maintenance**: Comprehensive maintenance planning and tracking
- **Health Score Calculation**: Automated camera health assessment
- **Maintenance History**: Complete maintenance logs and technician records
- **Alert Management**: Proactive alerts for overdue maintenance and warranty expiry
- **Technician Assignment**: Task assignment and progress tracking
│   ├── style.css       # Modern responsive styling
│   └── app.js          # Frontend JavaScript
├── ai/                 # Python AI services (optional)
│   ├── app.py          # Flask AI service
│   └── requirements.txt
├── data/               # SQLite database (auto-created)
└── package.json        # Dependencies and scripts
```

## ⚡ Quick Start

**Option 1 - Complete Setup (Recommended):**
```bash
setup-mongodb.bat
```

**Option 2 - Quick Start (MongoDB Required):**
```bash
start.bat
```

**Option 3 - Manual Setup:**
```bash
# 1. Install MongoDB and start it
# 2. Install dependencies
npm install

# 3. Configure API keys in .env (optional)
# 4. Start main application
npm start

# 5. Start AI service (optional)
npm run ai
```

**Prerequisites:**
- MongoDB (local or Atlas)
- Node.js 14+
- Python 3.8+ (for AI service)

## 🌐 Access Points

- **📊 Main Dashboard**: http://localhost:3000
- **🔌 API Endpoints**: http://localhost:3000/api/*
- **🤖 AI Service**: http://localhost:8000 (optional)

## 🎯 How It Works

1. **Real-time Monitoring**: System continuously monitors traffic at multiple intersections
2. **Smart Detection**: AI-powered vehicle detection with fallback to realistic mock data
3. **Intelligent Optimization**: Machine learning algorithms optimize signal timings
4. **Predictive Analytics**: Forecasts future traffic patterns and congestion
5. **Interactive Control**: Click any intersection to select and control it
6. **Live Updates**: Real-time data streaming via WebSocket connections

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5/CSS3/JavaScript (no frameworks)
- **Backend**: Node.js + Express + Socket.IO + Mongoose
- **Database**: MongoDB (with real intersection data)
- **Real Data APIs**: TomTom, Google Maps, HERE, OpenWeather
- **AI Services**: Python + Flask + OpenCV + TensorFlow
- **Real-time**: WebSocket communication + Scheduled updates
- **Styling**: Modern CSS Grid/Flexbox with glassmorphism design

## 🌍 Real Data Sources

### **Traffic APIs**
- **TomTom Traffic API**: Real-time traffic flow and speed data
- **Google Maps API**: Road network and traffic conditions
- **HERE Traffic API**: Live traffic flow with jam factors
- **OpenWeather API**: Weather conditions affecting traffic

### **Real Intersections**
- **Times Square, NYC**: Broadway & 42nd Street
- **Oxford Circus, London**: Oxford Street intersection
- **Shibuya Crossing, Tokyo**: World's busiest pedestrian crossing
- **Hollywood & Highland, LA**: Major Los Angeles intersection
- **Champs-Élysées, Paris**: Arc de Triomphe area
- **Orchard Road, Singapore**: Central business district
- **George Street, Sydney**: CBD main intersection

## 📱 Features Showcase

### Dashboard Overview
- **Live Metrics**: Total intersections, active vehicles, average speed, congestion alerts
- **Visual Status**: Color-coded intersection cards with real-time updates
- **Smart Controls**: One-click optimization, detection, and prediction

### AI Integration
- **Automatic Fallback**: Works with or without AI service
- **Confidence Scoring**: All AI recommendations include confidence levels
- **Reasoning Engine**: Explains why optimizations were made

### User Experience
- **Click-to-Select**: Click any intersection card to select it
- **Visual Feedback**: Selected intersections highlighted with blue border
- **Real-time Updates**: Live data streaming without page refresh
- **Mobile Responsive**: Full functionality on all device sizes

## 🔧 System Requirements

- **Node.js**: 14.0 or higher
- **Python**: 3.8 or higher (for AI service)
- **Browser**: Modern browser with WebSocket support
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB free space

## 🎨 Modern UI Features

- **Glassmorphism Design**: Translucent cards with backdrop blur
- **Gradient Backgrounds**: Beautiful color transitions
- **Smooth Animations**: Hover effects and transitions
- **Responsive Grid**: Adapts to any screen size
- **Dark/Light Elements**: High contrast for readability
- **Icon Integration**: Emoji icons for visual clarity

The system is production-ready with comprehensive error handling, graceful degradation, and works perfectly with or without the AI service!