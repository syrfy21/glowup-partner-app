// Firebase config for Grow Together app
// This file contains your Firebase project configuration.
// Make sure Authentication Email/Password, Firestore, and Storage are enabled.
export const firebaseConfig = {
  apiKey: "AIzaSyAiTsj_uNW408xVKQg7arkE76GtEhpevo",
  authDomain: "glowup-partner-cbb33.firebaseapp.com",
  projectId: "glowup-partner-cbb33",
  storageBucket: "glowup-partner-cbb33.firebasestorage.app",
  messagingSenderId: "1092215193109",
  appId: "1:1092215193109:web:e7661f0feb95ee7758981c",
  measurementId: "G-DBTWXHGYEC",

  // Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
  // Generate a key pair and paste the PUBLIC VAPID key here.
  vapidKey: "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE"
};


// YouTube search inside Now Playing.
// Enable YouTube Data API v3, create a browser API key, restrict it to your Hosting domain,
// and paste it below. The embedded player itself does not need this key; search does.
export const youtubeConfig = {
  apiKey: "PASTE_YOUR_YOUTUBE_DATA_API_KEY_HERE"
};
