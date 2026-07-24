#!/bin/bash
set -e
echo "Starting Android build process..."
npx cap sync android
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
