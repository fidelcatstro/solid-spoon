#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
npx cap sync android
echo "Navigating to Android directory..."
cd "$(dirname "$0")/../android"
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
