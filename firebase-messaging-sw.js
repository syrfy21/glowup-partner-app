/* Firebase Messaging service worker — must stay at the Hosting root. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAiTsj_uNW408xVKQg7arkE76GtEhpevo",
  authDomain: "glowup-partner-cbb33.firebaseapp.com",
  projectId: "glowup-partner-cbb33",
  storageBucket: "glowup-partner-cbb33.firebasestorage.app",
  messagingSenderId: "1092215193109",
  appId: "1:1092215193109:web:e7661f0feb95ee7758981c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || "Grow Together";
  const tag = data.tag || "grow-together";
  const isRoutineReminder = tag.startsWith("routine-");
  const options = {
    body: data.body || "You have a new shared update.",
    icon: "/icons/heart.svg",
    badge: "/icons/heart.svg",
    tag,
    renotify: true,
    requireInteraction: isRoutineReminder,
    vibrate: isRoutineReminder ? [180, 90, 180, 90, 260] : [120, 60, 120],
    data: { url: data.url || "/", ...data }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        if ("navigate" in client) await client.navigate(destination);
        return;
      }
    }
    await clients.openWindow(destination);
  })());
});
