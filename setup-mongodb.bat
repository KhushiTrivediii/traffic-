@echo off
echo 🚀 Setting up AI Traffic Management System with MongoDB

echo.
echo === Prerequisites Check ===

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i
)

REM Check if MongoDB is running
echo Checking MongoDB connection...
mongosh --eval "db.runCommand('ping')" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  MongoDB is not running or not installed
    echo.
    echo 📥 MongoDB Installation Options:
    echo   1. Install MongoDB Community Server from: https://www.mongodb.com/try/download/community
    echo   2. Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas
    echo   3. Use Docker: docker run -d -p 27017:27017 --name mongodb mongo
    echo.
    set /p choice="Continue anyway? (y/n): "
    if /i not "%choice%"=="y" exit /b 1
) else (
    echo ✅ MongoDB is running
)

echo.
echo === Installing Dependencies ===

REM Install Node.js dependencies
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)

REM Install Python dependencies for AI service
echo Installing Python AI dependencies...
cd ai
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install Python dependencies
    echo Make sure Python and pip are installed
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo === Configuration ===

REM Check if .env exists
if not exist ".env" (
    echo 📋 .env file already exists
) else (
    echo ⚠️  .env file not found, using defaults
)

echo.
echo 🔑 API Key Configuration:
echo Edit .env file to add your API keys for real traffic data:
echo   - TOMTOM_API_KEY=your_key_here
echo   - GOOGLE_MAPS_API_KEY=your_key_here  
echo   - HERE_API_KEY=your_key_here
echo   - OPENWEATHER_API_KEY=your_key_here
echo.
echo 💡 Without API keys, the system uses realistic mock data

echo.
echo === Database Setup ===

echo 🗄️  MongoDB will be automatically seeded with real intersection data
echo    Including: Times Square, Oxford Circus, Shibuya Crossing, and more!

echo.
echo ✅ Setup completed successfully!
echo.
echo 🚀 To start the system:
echo   1. Make sure MongoDB is running
echo   2. Run: npm start
echo   3. Optional: Run AI service with: npm run ai
echo   4. Open: http://localhost:3000
echo.

set /p choice="Start the system now? (y/n): "
if /i "%choice%"=="y" (
    echo Starting system...
    start "Traffic Management" cmd /k "npm start"
    timeout /t 3 /nobreak >nul
    start "AI Service" cmd /k "npm run ai"
    timeout /t 3 /nobreak >nul
    start http://localhost:3000
)

echo.
echo 🎉 AI Traffic Management System is ready!
pause