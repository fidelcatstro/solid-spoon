#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
if [ ! -d "android" ]; then
  npx @capacitor/cli add android
else
  echo "Android platform already exists, syncing..."
  npx @capacitor/cli sync android
fi
echo "Running gradle build via absolute path..."
chmod +x ./android/gradlew
./android/gradlew assembleDebug -p ./android
echo "Build completed successfully!"
