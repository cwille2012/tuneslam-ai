#!/bin/bash

# TuneSlam - Start All Services Script

echo "🎵 Starting TuneSlam..."
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   sudo systemctl start mongod"
    echo ""
fi

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "⚠️  Redis is not running. Please start Redis first:"
    echo "   sudo systemctl start redis"
    echo ""
fi

echo "Starting services in separate terminals..."
echo ""
echo "📡 Backend will run on: http://localhost:5000"
echo "⚙️  Admin Dashboard will run on: http://localhost:5173"
echo "📱 User Interface will run on: http://localhost:5174"
echo "📺 TV Viewer will run on: http://localhost:5175"
echo ""
echo "Press Ctrl+C in each terminal to stop the services"
echo ""

# Start backend
gnome-terminal --title="TuneSlam Backend" -- bash -c "cd backend && npm run dev; exec bash" &

# Wait a bit for backend to start
sleep 2

# Start admin dashboard
gnome-terminal --title="TuneSlam Admin" -- bash -c "cd frontend/admin && npm run dev; exec bash" &

# Start user interface
gnome-terminal --title="TuneSlam User" -- bash -c "cd frontend/user && npm run dev; exec bash" &

# Start TV viewer
gnome-terminal --title="TuneSlam Viewer" -- bash -c "cd frontend/viewer && npm run dev; exec bash" &

echo "✅ All services started!"
echo ""
echo "🌐 Open these URLs in your browser:"
echo "   Admin: http://localhost:5173"
echo "   User:  http://localhost:5174/session/{sessionName}"
echo "   TV:    http://localhost:5175/viewer/{sessionName}"
