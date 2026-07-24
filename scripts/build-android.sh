#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
echo "Recreating Android platform cleanly..."
rm -rf android
npx @capacitor/cli add android
npx @capacitor/cli sync android
echo "Running gradle build..."
chmod +x ./android/gradlew
./android/gradlew assembleDebug -p ./android
echo "Build completed successfully!"
