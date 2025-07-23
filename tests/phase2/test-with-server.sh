#!/bin/bash
# Script to run Phase 2 API tests with local development server

echo "🚀 Starting Phase 2 API Tests with Local Server"
echo "==============================================="

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        echo "   ✅ Server stopped"
    fi
    exit $1
}

# Set trap to cleanup on exit
trap 'cleanup $?' INT TERM EXIT

# Build the project first
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Start development server in background
echo "🌐 Starting development server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Check if server is running
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✅ Server started successfully"
echo ""

# Set test environment
export TEST_API_URL="http://localhost:5173"
export NODE_ENV="development"

# Run API tests
echo "🧪 Running Phase 2 API tests..."
npm run test:phase2-api

# Store exit code
TEST_EXIT_CODE=$?

# Cleanup will be called automatically by trap
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All Phase 2 API tests completed successfully!"
else
    echo ""
    echo "❌ Some Phase 2 API tests failed"
fi

exit $TEST_EXIT_CODE