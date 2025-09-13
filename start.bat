@echo off
echo 🚀 Starting AI Traffic Management System with Real Data

echo.
echo === System Check ===

REM Check MongoDB
mongosh --eval "db.runCommand('ping')" >nul 2>&1
if errorlevel 1 (
    echo ❌ MongoDB is not running
    echo Please start MongoDB or run: setup-mongodb.bat
    pause
    exit /b 1
) else (
    echo ✅ MongoDB is running
)

echo.
echo 📦 Installing dependencies...

REM Install Node.js dependencies
call npm install >nul 2>&1
if errorlevel 1 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)

REM Install Python dependencies
cd ai
pip install -r requirements.txt >nul 2>&1
cd ..

echo ✅ Dependencies ready
echo.

REM Start the services
echo 🚀 Starting services...
echo.
echo 🗄️  Database: MongoDB with real intersection data
echo 🌍 Traffic APIs: TomTom, Google Maps, HERE, OpenWeather
echo 📊 Dashboard: http://localhost:3000
echo 🤖 AI Service: http://localhost:8000

start "Traffic Management System" cmd /k "npm start"
timeout /t 3 /nobreak >nul

start "AI Service" cmd /k "npm run ai"
timeout /t 3 /nobreak >nul

echo.
echo ✅ System started with real traffic data!
echo.
echo 🌟 Features:
echo   • Real intersections from major cities worldwide
echo   • Live traffic data from multiple APIs
echo   • Weather-adjusted traffic patterns
echo   • Historical data analysis
echo   • AI-powered optimization
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000

echo Press any key to exit...
pause >nul