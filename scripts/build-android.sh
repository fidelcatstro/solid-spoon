#!/bin/bash
set -e
echo "Starting Android build process..."
npm run build
npx @capacitor/cli copy android
npx @capacitor/cli update android
if [ ! -f "android/gradlew" ]; then
  echo "Gradle wrapper missing, generating android platform..."
  npx @capacitor/cli add android
fi
echo "Entering android directory..."
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "Build completed successfully!"
