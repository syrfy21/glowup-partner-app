// Firebase config for Grow Together app
// This file contains your Firebase project configuration.
// Make sure Authentication Email/Password, Firestore, and Storage are enabled.
export const firebaseConfig = {
  apiKey: "AIza*****************************",
  authDomain: "glowup-partner-cbb33.firebaseapp.com",
  projectId: "glowup-partner-cbb33",
  storageBucket: "glowup-partner-cbb33.firebasestorage.app",
  messagingSenderId: "1******************",
  appId: "1:1092****************************c",
  measurementId: "**************",

  // Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
  // Generate a key pair and paste the PUBLIC VAPID key here.
  vapidKey: "*********************"
};


// YouTube search inside Now Playing.
// Enable YouTube Data API v3, create a browser API key, restrict it to your Hosting domain,
// and paste it below. The embedded player itself does not need this key; search does.
export const youtubeConfig = {
  apiKey: "*******************"
};
