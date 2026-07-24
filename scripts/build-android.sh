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
echo "Entering android directory..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
