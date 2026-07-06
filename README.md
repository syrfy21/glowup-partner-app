# Grow Together v7

A Firebase couple app with dedicated feature pages, a persistent in-app music player, direct camera capture plus gallery selection, and timed daily routines with repeated reminders.

## What changed in v7

- Every dashboard card opens a dedicated full-screen feature page in the same tab, with a Back button.
- Premium dashboard and feature-page redesign.
- Now Playing remains active while moving between app sections.
- Media Session metadata and play/pause controls are added where the browser supports them.
- Image forms now show two separate choices: **Choose from Gallery** and **Take Photo Now**. The camera capture is confirmed before upload.
- Routines now include a daily reminder time and repeat interval.
- Each routine resets daily and can be marked **Done**, **Not Today**, or **Pending**.
- Foreground reminder sound/vibration while the app is open.
- Background routine push reminders through a scheduled Firebase Function (checked every 5 minutes) until the item is Done or Not Today.

## Important music limitation

Song search and playback use the official YouTube Data API and YouTube IFrame Player. The player persists between sections inside Grow Together. YouTube policy does not allow an API client to create background play while the app window is closed or minimized. Mobile operating systems may also suspend the browser when the screen locks. A native mobile app or a separately licensed audio-streaming integration is required for guaranteed screen-off background playback.

## Required keys

Edit `firebase-config.js` and keep:

- Your Firebase Web Push public VAPID key.
- Your restricted YouTube Data API v3 browser key.

## Cloud Shell deployment

```bash
unzip -o glowup-partner-mvp-ultra-v7.zip
cd glowup-partner-mvp-ultra-v7

cd functions
nvm install 22
nvm use 22
rm -rf node_modules package-lock.json .npmrc
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
cd ..
```

Deploy Functions first:

```bash
firebase deploy --project glowup-partner-cbb33 --only functions
```

Then deploy the site and rules:

```bash
firebase deploy --project glowup-partner-cbb33 --only hosting,firestore:rules,storage
```

The new scheduled function is named `sendRoutineReminders`. The place-file cleanup function is named `cleanupPlaceStorage` to avoid the older `cleanupPlace` trigger-type conflict. After the new deployment succeeds, the obsolete function can be removed:

```bash
firebase functions:delete cleanupPlace --region europe-west1 --project glowup-partner-cbb33 --force
```

## Reminder behavior

- Enable Notifications on each phone/computer.
- A foreground reminder can fire at the selected minute while the app is open. Background push is checked every 5 minutes, so delivery can be a few minutes after the selected time, and then repeats at the chosen interval.
- Reminders stop for that day when the owner marks the routine Done or Not Today.
- Browser notifications use the device's notification sound settings. A website cannot force a continuous alarm sound while the browser is suspended.
