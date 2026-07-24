#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
if [ ! -d "android" ]; then
  echo "Android directory missing, adding platform..."
  npx cap add android
fi
npx cap sync android
echo "Navigating to Android directory..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
