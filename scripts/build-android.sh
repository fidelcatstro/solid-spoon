#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
npx @capacitor/cli add android
npx @capacitor/cli sync android
echo "Entering android directory..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
