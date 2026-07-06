import { firebaseConfig, youtubeConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  orderBy,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported as isMessagingSupported
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

const firebaseLooksReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_");
const app = firebaseLooksReady ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;
let messaging = null;
let messagingServiceWorkerRegistration = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  user: null,
  profile: null,
  coupleId: null,
  couple: null,
  activeSection: "home",
  unsubscribers: [],
  data: {
    routines: [], memories: [], events: [], letters: [], wishes: [], gratitude: [],
    dreams: [], timelineEvents: [], surprises: [], activity: [], azkarLogs: [], moodToday: null,
    music: null, places: [], quizAnswers: [], thisOrThatAnswers: [], goodNight: [],
    momentChallenges: [], skyEntries: [], soundtrack: []
  },
  lastMusicPing: null,
  lastMomentPing: null,
  musicSync: { joinedSessionId: null, applyingRemote: false, heartbeat: null, correction: null, youtubePlayer: null, youtubeReady: false, loadedSessionId: null, loadingSessionId: null },
  musicSearchResults: [],
  cameraTarget: null,
  cameraStream: null,
  capturedFiles: new WeakMap(),
  pushReady: false,
  pushToken: null,
  pushDeviceId: null,
  routineReminderTimer: null,
  reminderAudioContext: null,
  reminderAudioUnlocked: false
};

const navItems = [
  { id: "routine", icon: "✅", title: "Routine", sub: "Personal habits for each partner" },
  { id: "memories", icon: "📸", title: "Memories", sub: "Photos, videos, and daily notes" },
  { id: "progress", icon: "📈", title: "Progress", sub: "Automatic achievements" },
  { id: "timers", icon: "⏳", title: "Timers", sub: "Countdowns and memories" },
  { id: "letters", icon: "💌", title: "Future Letters", sub: "Letters that open later" },
  { id: "wishlist", icon: "🌙", title: "Wish List", sub: "Things to do together" },
  { id: "dateIdeas", icon: "🎲", title: "Date Ideas", sub: "Random ideas button" },
  { id: "gratitude", icon: "🤍", title: "Gratitude", sub: "Thankful moments" },
  { id: "dreams", icon: "🏡", title: "Dream Board", sub: "Your future vision" },
  { id: "rescue", icon: "", iconHtml: rescueIconSvg(), title: "Quick Rescue", sub: "For difficult days" },
  { id: "azkar", icon: "📿", title: "Daily Reminders", sub: "Daily reflection counter" },
  { id: "timeline", icon: "🕊️", title: "Life Timeline", sub: "Your story in one place" },
  { id: "mood", icon: "😊", title: "Mood Sync", sub: "Emotional match" },
  { id: "music", icon: "🎧", title: "Now Playing", sub: "Listen together" },
  { id: "surprise", icon: "🎁", title: "Secret Surprise", sub: "Scheduled digital gifts" },
  { id: "places", icon: "🗺️", title: "Where We Were", sub: "Memory map and future places" },
  { id: "quiz", icon: "🧩", title: "Couple Quiz", sub: "How well you know each other" },
  { id: "thisOrThat", icon: "🎭", title: "This Or That", sub: "Similarity score" },
  { id: "goodNight", icon: "🌙", title: "Good Night", sub: "Before-sleep capsule" },
  { id: "sameMoment", icon: "📸", title: "Same Moment", sub: "Photos at the same time" },
  { id: "sky", icon: "☁️", title: "Today’s Sky", sub: "Upload your sky and write" },
  { id: "plant", icon: "", iconHtml: plantIconSvg(), title: "Love Plant", sub: "A digital plant that grows" }
];

function rescueIconSvg(className = "nav-svg-icon") {
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" stroke-width="10"/><path d="M16 16l10 10M48 16L38 26M16 48l10-10M48 48L38 38" stroke="currentColor" stroke-width="8" stroke-linecap="round"/></svg>`;
}

function plantIconSvg(className = "nav-svg-icon", stage = 3) {
  const flower = stage >= 5 ? `<circle cx="35" cy="13" r="6" fill="#ff8fc7"/><circle cx="29" cy="16" r="5" fill="#ffd3eb"/><circle cx="40" cy="18" r="5" fill="#b98cff"/><circle cx="35" cy="18" r="3" fill="#ffd166"/>` : "";
  const extra = stage >= 3 ? `<path d="M32 35C17 34 14 24 14 18c11 0 19 5 20 15M34 29c2-13 10-18 19-18 0 9-5 18-19 20" fill="none" stroke="#77d6a0" stroke-width="6" stroke-linecap="round"/>` : "";
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 47V23" stroke="#77d6a0" stroke-width="6" stroke-linecap="round"/><path d="M31 36C19 35 15 28 15 21c10 0 16 5 17 14M33 28c2-10 8-15 17-15 0 8-5 15-17 17" fill="#8ce0ae" stroke="#54b982" stroke-width="2"/>${extra}${flower}<path d="M18 43h29l-4 16H22z" fill="#c4835a" stroke="#ffd5bd" stroke-width="2"/><path d="M16 41h33v6H16z" fill="#e5a376"/></svg>`;
}

const routineSuggestions = [
  ["Fajr prayer", "prayer", "check"], ["All daily prayers", "prayer", "check"],
  ["Gym", "gym", "check"], ["30-minute walk", "gym", "check"],
  ["Programming", "programming", "hours"], ["Drink 2L of water", "water", "check"],
  ["Read 10 pages", "learning", "check"], ["No smoking/vaping for one day", "challenge", "check"],
  ["Less screen time", "health", "check"], ["Sleep early", "health", "check"]
];

const dateIdeas = [
  "Romantic movie night with popcorn and no phones", "Start a short series together", "Question game: ask each other 10 deep questions",
  "Cooking date: make a new recipe together", "Walk date: 30 minutes and talk about your week", "Gaming night: play a light co-op game",
  "Memory night: open your first photo together and tell the story", "Dream board date: each of you adds 3 dreams", "Budget date: plan something you want to buy together",
  "Study together: 45 minutes focus + 15 minutes talk", "No screens date: one hour without screens", "Home coffee date with calm music",
  "Write letters to open after one year", "Fitness date: do a simple workout together", "Reflection date: read a page or do daily reminders together",
  "Restaurant wish: pick a restaurant for your wish list", "Playlist date: each of you adds 5 songs", "Photo challenge: each of you captures the best part of the day",
  "Kindness date: do one small helpful thing for each other", "Planning date: choose one monthly goal", "Movie debate: rate the movie after watching it",
  "Home picnic: blanket, simple food, soft light", "Puzzle or chess date", "Learn one English phrase together", "Make a shared GitHub mini project",
  "10-minute honest talk: what do you need from me?", "Surprise date: each prepares something small", "Old messages date: read a sweet old message",
  "Gratitude round: list 5 things you are thankful for", "Future trip plan: pick a city or country to visit", "Try a new dessert together",
  "Draw each other badly and laugh", "Make a list: 20 things we want", "Watch the sunset if possible", "Voice-note date if you are apart",
  "Build a tiny website page together", "Clean space date: organize one small corner", "Water challenge day", "Bookstore/library idea",
  "Deep talk: childhood memories", "Deep talk: biggest fear", "Deep talk: proudest moment", "Deep talk: what love means to me",
  "Choose one habit to improve this week", "Plan an engagement/wedding moodboard", "Make matching wallpapers", "Try a 7-minute workout",
  "Cook noodles like a fancy chef", "Pick a random Wikipedia article and discuss", "Make a shared prayer goal", "Write 3 compliments",
  "Create a bad day rescue plan", "Watch a documentary", "Make a savings jar plan", "Learn a new skill for 20 minutes"
];

const rescueIdeas = [
  "Drink water now, then decide what to do next.", "Take two quiet minutes to pray, breathe, and reset.", "Step away from screens for 15 minutes.",
  "Send a sweet message without starting a heavy discussion.", "Talk for 10 minutes using: I feel... and I need...",
  "Review one tiny goal instead of judging the whole day.", "Sleep earlier tonight; do not be too hard on yourselves.", "Walk for 10 minutes or open a window for fresh air.",
  "Write 3 things you are grateful for.", "Play a calm song with no blame and no argument.", "Ask: what can I do for you right now?",
  "Postpone the heavy conversation until tomorrow at a clear time."
];


const quizQuestions = [
  "What’s their favorite drink?", "What’s their dream country?", "What food makes them instantly happy?",
  "What is their biggest dream right now?", "What is their comfort song?", "What is their favorite dessert?",
  "What is their favorite color?", "What makes them feel loved the most?", "What is their biggest fear?",
  "What is their favorite movie or series?", "What is their favorite place to sit and think?", "What annoys them quickly?",
  "What do they order at a café?", "What is their favorite smell?", "What is their love language?",
  "What country would they visit first?", "What is their dream job?", "What habit are they trying to build?",
  "What is their favorite memory with you?", "What gift would make them happiest?", "What is their favorite time of day?",
  "What makes them calm down?", "What is their favorite app?", "What is their favorite outfit style?",
  "What is their childhood dream?", "What skill do they want to learn?", "What is their favorite animal?",
  "What is one thing they want to stop doing?", "What is one thing they are proud of?", "What is their perfect date idea?"
].map((text, index) => ({ id: `q${index + 1}`, text }));

const thisOrThatQuestions = [
  ["Coffee ☕", "Tea 🍵"], ["Beach 🏖️", "Mountains ⛰️"], ["Movie 🎬", "Series 📺"], ["Pizza 🍕", "Burger 🍔"],
  ["Night 🌙", "Morning 🌅"], ["Cats 🐱", "Dogs 🐶"], ["Travel ✈️", "Staycation 🏠"], ["Sweet 🍫", "Salty 🍟"],
  ["Rain 🌧️", "Sun ☀️"], ["Gym 🏋️", "Walk 🚶"], ["Call 📞", "Text 💬"], ["Surprise 🎁", "Plan 📋"],
  ["City 🏙️", "Village 🌿"], ["Arabic songs 🎶", "English songs 🎧"], ["Home date 🏡", "Restaurant date 🍽️"], ["Books 📚", "Videos ▶️"],
  ["Comedy 😂", "Romance 🤍"], ["Adventure 🔥", "Calm 😌"], ["Coding 💻", "Design 🎨"], ["Winter ❄️", "Summer 🌞"],
  ["Chocolate 🍫", "Ice cream 🍦"], ["Voice note 🎙️", "Long message ✍️"], ["Formal 👔", "Casual 👟"], ["Car ride 🚗", "Walking date 🚶"],
  ["Spicy 🌶️", "Mild 🧂"], ["Photos 📸", "Videos 🎥"], ["Plan the future 🗓️", "Live the moment ✨"], ["Sunset 🌇", "Stars ✨"]
].map((choices, index) => ({ id: `t${index + 1}`, a: choices[0], b: choices[1] }));

const skyMoods = [
  { emoji: "🌤️", name: "Soft Gold", gradient: "linear-gradient(135deg,#ffd6a5,#fdffb6,#caffbf)" },
  { emoji: "🌧️", name: "Rainy Heart", gradient: "linear-gradient(135deg,#a0c4ff,#bdb2ff,#ffc6ff)" },
  { emoji: "🌌", name: "Starry Calm", gradient: "linear-gradient(135deg,#090979,#4b0082,#ff8fc7)" },
  { emoji: "☁️", name: "Cloud Hug", gradient: "linear-gradient(135deg,#dfe9f3,#ffffff,#b8c6db)" },
  { emoji: "🌅", name: "Sunset Promise", gradient: "linear-gradient(135deg,#ff9a9e,#fad0c4,#fbc2eb)" },
  { emoji: "🌙", name: "Moon Talk", gradient: "linear-gradient(135deg,#232526,#414345,#8e9eab)" },
  { emoji: "🌈", name: "Rainbow Day", gradient: "linear-gradient(135deg,#ffadad,#ffd6a5,#fdffb6,#caffbf,#9bf6ff,#bdb2ff)" }
];

const azkarGroups = {
  morning: [
    { text: "Morning reflection: start the day with gratitude and intention.", target: 1 },
    { text: "Breathe, reset, and choose one kind action for today.", target: 1 },
    { text: "Say thank you for one blessing.", target: 10 },
    { text: "Ask for forgiveness and a cleaner heart.", target: 10 }
  ],
  evening: [
    { text: "Evening reflection: review the day gently.", target: 1 },
    { text: "Name one thing you learned today.", target: 1 },
    { text: "Choose peace before sleep.", target: 3 },
    { text: "Send a blessing or kind thought to your partner.", target: 10 }
  ],
  sleep: [
    { text: "Good night reflection: release the day and rest.", target: 1 },
    { text: "Count three calm breaths.", target: 3 },
    { text: "Think of one thing you want to improve tomorrow.", target: 1 }
  ]
};

function showToast(message, duration = 4200) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), duration);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoWeek(dateString) {
  const d = new Date(dateString + "T12:00:00");
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(dateString + "T12:00:00"));
}

function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = String(dateString).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function makeAnnualDate(year, monthIndex, day) {
  const candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
  if (candidate.getMonth() !== monthIndex) return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0);
  return candidate;
}

function eventRecurrence(event = {}) {
  if (event.recurrence) return event.recurrence;
  return ["birthday", "anniversary"].includes(event.type) ? "annual" : "none";
}

function nextEventOccurrence(event, now = new Date()) {
  const original = parseLocalDate(event?.date);
  if (!original) return null;
  if (eventRecurrence(event) !== "annual") return original;
  let next = makeAnnualDate(now.getFullYear(), original.getMonth(), original.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  if (next < today) next = makeAnnualDate(now.getFullYear() + 1, original.getMonth(), original.getDate());
  return next;
}

function eventYearsSince(event, occurrence = nextEventOccurrence(event)) {
  const original = parseLocalDate(event?.date);
  if (!original || !occurrence) return 0;
  return Math.max(0, occurrence.getFullYear() - original.getFullYear());
}

function randomId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function hashText(value) {
  if (!crypto?.subtle) return btoa(unescape(encodeURIComponent(value))).replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function makeCode() {
  return "GLOW-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function uid() {
  return state.user?.uid;
}

function coupleMembers() {
  const members = state.couple?.members || {};
  return (state.couple?.memberIds || []).map(id => ({ id, ...(members[id] || {}) }));
}

function memberName(memberUid) {
  return state.couple?.members?.[memberUid]?.name || (memberUid === uid() ? state.profile?.name : "Partner");
}

function partnerName() {
  const other = coupleMembers().find(m => m.id !== uid());
  return other?.name || "Partner";
}

function publicMemberProfile(profile = {}) {
  return {
    name: profile.name || "Partner",
    birthDate: profile.birthDate || "",
    city: profile.city || "",
    favoriteDrink: profile.favoriteDrink || "",
    dreamCountry: profile.dreamCountry || ""
  };
}

function showScreen(id) {
  $$(".screen").forEach(s => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function assertFirebaseReady() {
  if (!firebaseLooksReady) {
    showToast("Add your Firebase config inside firebase-config.js first.");
    return false;
  }
  return true;
}

function bindStaticEvents() {
  $$("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      $$("[data-auth-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const isLogin = btn.dataset.authTab === "login";
      $("#loginForm").classList.toggle("hidden", !isLogin);
      $("#signupForm").classList.toggle("hidden", isLogin);
    });
  });

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!assertFirebaseReady()) return;
    try {
      await signInWithEmailAndPassword(auth, $("#loginEmail").value.trim(), $("#loginPassword").value);
    } catch (err) { showToast("Login failed: " + err.message); }
  });

  $("#forgotPasswordBtn").addEventListener("click", async () => {
    if (!assertFirebaseReady()) return;
    const email = $("#loginEmail").value.trim() || prompt("Enter your email to receive the password reset link:");
    if (!email) return showToast("Enter your email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Password reset link sent to your email.");
    } catch (err) { showToast("Could not send reset link: " + err.message); }
  });

  $("#signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!assertFirebaseReady()) return;
    try {
      const name = $("#signupName").value.trim();
      const profileData = {
        name,
        birthDate: $("#signupBirthDate")?.value || "",
        phone: $("#signupPhone")?.value.trim() || "",
        city: $("#signupCity")?.value.trim() || "",
        favoriteDrink: $("#signupFavoriteDrink")?.value.trim() || "",
        dreamCountry: $("#signupDreamCountry")?.value.trim() || "",
        createdAt: serverTimestamp()
      };
      const cred = await createUserWithEmailAndPassword(auth, $("#signupEmail").value.trim(), $("#signupPassword").value);
      await setDoc(doc(db, "users", cred.user.uid), profileData);
      showToast("Account created. Link your partner now.");
    } catch (err) { showToast("Account creation failed: " + err.message); }
  });

  $("#createCoupleBtn").addEventListener("click", createCouple);
  $("#joinCoupleBtn").addEventListener("click", joinCouple);
  $("#logoutBtn").addEventListener("click", logoutAndDisablePush);
  $("#logoutBtnPair").addEventListener("click", logoutAndDisablePush);
  $("#globalPushBtn")?.addEventListener("click", requestNotifications);
  $("#sectionNotificationsBtn")?.addEventListener("click", requestNotifications);
  $("#backHomeBtn")?.addEventListener("click", showDashboardHome);
  $("#dockOpenMusicBtn")?.addEventListener("click", () => openFeatureSection("music"));
  $("#dockPlayPauseBtn")?.addEventListener("click", toggleDockPlayback);
  $("#dockInviteBtn")?.addEventListener("click", pingMusic);
  $("#restoreStreakBtn").addEventListener("click", restoreStreak);
  $("#closeCameraBtn")?.addEventListener("click", closeCamera);
  $("#capturePhotoBtn")?.addEventListener("click", captureCameraPhoto);
  $("#retakePhotoBtn")?.addEventListener("click", retakeCameraPhoto);
  $("#usePhotoBtn")?.addEventListener("click", confirmCameraPhoto);
  $("#cameraModal")?.addEventListener("click", event => { if (event.target.id === "cameraModal") closeCamera(); });
  document.addEventListener("reset", event => {
    setTimeout(() => {
      $$('input[type="file"]', event.target).forEach(input => state.capturedFiles.delete(input));
      $$('.captured-file-note', event.target).forEach(note => { note.textContent = ""; note.classList.add("hidden"); });
    }, 0);
  });
  document.addEventListener("pointerdown", unlockReminderAudio, { once: true });
}


async function createCouple() {
  const startDate = $("#relationshipStartDate").value;
  if (!startDate) return showToast("Choose the relationship start date first.");
  const code = makeCode();
  const coupleRef = doc(collection(db, "couples"));
  const profile = state.profile || { name: "Partner" };
  await setDoc(coupleRef, {
    inviteCode: code,
    startDate,
    memberIds: [uid()],
    members: { [uid()]: publicMemberProfile(profile) },
    restoresUsed: { [uid()]: 0 },
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "inviteCodes", code), { coupleId: coupleRef.id, createdBy: uid(), createdAt: serverTimestamp() });
  await updateDoc(doc(db, "users", uid()), { coupleId: coupleRef.id });
  state.profile = { ...state.profile, coupleId: coupleRef.id };
  showScreen("#dashboardView");
  startDashboard(coupleRef.id);
  initializePushMessaging().catch(() => {});
  showToast(`Your partner code is ${code}. Copy it from the dashboard and send it to your partner.`);
}

async function joinCouple() {
  const code = $("#joinCode").value.trim().toUpperCase();
  if (!code) return showToast("Enter the code first.");
  const codeSnap = await getDoc(doc(db, "inviteCodes", code));
  if (!codeSnap.exists()) return showToast("Invalid code.");
  const coupleId = codeSnap.data().coupleId;
  const coupleRef = doc(db, "couples", coupleId);
  const profile = state.profile || { name: "Partner" };
  await updateDoc(coupleRef, {
    memberIds: arrayUnion(uid()),
    [`members.${uid()}`]: publicMemberProfile(profile),
    [`restoresUsed.${uid()}`]: 0
  });
  await updateDoc(doc(db, "users", uid()), { coupleId });
  state.profile = { ...state.profile, coupleId };
  showScreen("#dashboardView");
  startDashboard(coupleId);
  initializePushMessaging().catch(() => {});
  showToast("Linked successfully. You are now in the same shared space 🤍");
}

function cleanupSubscriptions() {
  state.unsubscribers.forEach(unsub => { try { unsub(); } catch (_) {} });
  state.unsubscribers = [];
  if (state.routineReminderTimer) clearInterval(state.routineReminderTimer);
  state.routineReminderTimer = null;
  if (typeof clearMusicSyncTimers === "function") clearMusicSyncTimers();
}

async function loadProfile(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) return snap.data();
  const fallback = { name: user.email?.split("@")[0] || "Partner", createdAt: serverTimestamp() };
  await setDoc(doc(db, "users", user.uid), fallback);
  return fallback;
}

function subscribeCollection(key, pathParts, options = {}) {
  const refCol = collection(db, ...pathParts);
  const q = options.order ? query(refCol, orderBy(options.order, options.dir || "desc")) : refCol;
  const unsub = onSnapshot(q, snap => {
    state.data[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderActiveSection();
    updateHero();
    if (key === "events") setTimeout(maybeAutoCelebrateToday, 120);
  }, err => console.warn("Subscription error", key, err));
  state.unsubscribers.push(unsub);
}

function startDashboard(coupleId) {
  cleanupSubscriptions();
  state.coupleId = coupleId;
  const requestedSection = new URLSearchParams(location.search).get("section");
  state.activeSection = requestedSection && navItems.some(item => item.id === requestedSection) ? requestedSection : "home";
  if (requestedSection) history.replaceState({}, document.title, location.pathname);
  startRoutineReminderEngine();

  const coupleUnsub = onSnapshot(doc(db, "couples", coupleId), snap => {
    state.couple = { id: snap.id, ...snap.data() };
    buildNav();
    updateHero();
    renderActiveSection();
    setTimeout(maybeAutoCelebrateToday, 150);
  });
  state.unsubscribers.push(coupleUnsub);

  subscribeCollection("routines", ["couples", coupleId, "routines"], { order: "createdAt" });
  subscribeCollection("memories", ["couples", coupleId, "memories"], { order: "createdAt" });
  subscribeCollection("events", ["couples", coupleId, "events"], { order: "date", dir: "asc" });
  subscribeCollection("letters", ["couples", coupleId, "letters"], { order: "openDate", dir: "asc" });
  subscribeCollection("wishes", ["couples", coupleId, "wishes"], { order: "createdAt" });
  subscribeCollection("gratitude", ["couples", coupleId, "gratitude"], { order: "createdAt" });
  subscribeCollection("dreams", ["couples", coupleId, "dreams"], { order: "createdAt" });
  subscribeCollection("timelineEvents", ["couples", coupleId, "timelineEvents"], { order: "date", dir: "desc" });
  subscribeCollection("surprises", ["couples", coupleId, "surprises"], { order: "openAt", dir: "asc" });
  subscribeCollection("activity", ["couples", coupleId, "activity"], { order: "date", dir: "desc" });
  subscribeCollection("azkarLogs", ["couples", coupleId, "azkarLogs"]);
  subscribeCollection("places", ["couples", coupleId, "places"], { order: "createdAt" });
  subscribeCollection("quizAnswers", ["couples", coupleId, "quizAnswers"]);
  subscribeCollection("thisOrThatAnswers", ["couples", coupleId, "thisOrThatAnswers"]);
  subscribeCollection("goodNight", ["couples", coupleId, "goodNight"]);
  subscribeCollection("skyEntries", ["couples", coupleId, "skyEntries"]);
  subscribeCollection("soundtrack", ["couples", coupleId, "soundtrack"], { order: "createdAt" });

  state.unsubscribers.push(onSnapshot(query(collection(db, "couples", coupleId, "momentChallenges"), orderBy("createdAt", "desc")), snap => {
    const previousPing = state.lastMomentPing;
    state.data.momentChallenges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const latest = state.data.momentChallenges[0];
    const ping = latest?.pingMillis;
    if (ping && previousPing && ping !== previousPing && latest.ownerUid !== uid()) {
      showToast(`${memberName(latest.ownerUid)} sent a Same Moment Challenge 📸`);
      notify("Same Moment Challenge", "Take a photo now 📷");
    }
    state.lastMomentPing = ping || previousPing;
    renderActiveSection();
  }));

  state.unsubscribers.push(onSnapshot(doc(db, "couples", coupleId, "mood", todayKey()), snap => {
    state.data.moodToday = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    renderActiveSection();
  }));

  state.unsubscribers.push(onSnapshot(doc(db, "couples", coupleId, "live", "music"), snap => {
    const previousPing = state.lastMusicPing;
    const previousSession = state.data.music?.sessionId;
    state.data.music = snap.exists() ? snap.data() : null;
    const ping = state.data.music?.notificationId || state.data.music?.lastUpdatedMillis;
    if (ping && previousPing && ping !== previousPing && state.data.music?.ownerUid !== uid()) {
      showToast(`${memberName(state.data.music.ownerUid)} invited you to listen: ${state.data.music.title || "Now Playing"}`);
      notify("Listen Together", `${memberName(state.data.music.ownerUid)} started ${state.data.music.title || "a song"}.`);
    }
    state.lastMusicPing = ping || previousPing;
    renderPersistentPlayer();
    if (previousSession === state.data.music?.sessionId) {
      applyRemoteMusicState();
      updateMusicStatusText();
    }
    if (state.activeSection === "music") renderActiveSection();
  }));
}

function buildNav() {
  const nav = $("#mainNav");
  nav.innerHTML = navItems.map((item, index) => `
    <button class="nav-btn feature-card" data-section="${item.id}" style="--card-index:${index}">
      <span class="nav-icon-wrap">${item.iconHtml || escapeHtml(item.icon)}</span>
      <span class="feature-card-copy"><b>${item.title}</b><small>${item.sub}</small></span>
      <span class="feature-arrow">→</span>
    </button>
  `).join("");
  $$('[data-section]', nav).forEach(btn => btn.addEventListener("click", () => openFeatureSection(btn.dataset.section)));
}

function showDashboardHome() {
  state.activeSection = "home";
  $("#dashboardView")?.classList.remove("feature-mode");
  $("#homeHub")?.classList.remove("hidden");
  $("#sectionShell")?.classList.add("hidden");
  history.replaceState({}, document.title, location.pathname);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openFeatureSection(sectionId) {
  if (!navItems.some(item => item.id === sectionId)) return;
  state.activeSection = sectionId;
  $("#dashboardView")?.classList.add("feature-mode");
  $("#homeHub")?.classList.add("hidden");
  $("#sectionShell")?.classList.remove("hidden");
  history.replaceState({}, document.title, `${location.pathname}?section=${encodeURIComponent(sectionId)}`);
  renderActiveSection();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHero() {
  if (!state.couple) return;
  const names = coupleMembers().map(m => m.name).filter(Boolean);
  $("#coupleTitle").textContent = names.length === 2 ? `${names[0]} & ${names[1]}` : `${state.profile?.name || "Me"} & ${partnerName()}`;
  $("#meName").textContent = state.profile?.name || "Me";
  $("#pairCodeMini").textContent = state.couple.inviteCode || "No code";
  updateTogetherTimer();
  const streak = calculateStreak();
  $("#streakText").textContent = `${streak} Days Growing Together`;
  const used = state.couple?.restoresUsed?.[uid()] || 0;
  $("#restoreText").textContent = `You have ${Math.max(0, 3 - used)} restores left out of 3`;
  const pushButton = $("#globalPushBtn");
  if (pushButton && !state.pushReady) pushButton.textContent = isIOSDevice() && !isStandaloneApp() ? "Install App for Alerts" : "Enable Notifications";
}

function relationshipTimeParts(startValue, now = new Date()) {
  const start = new Date(startValue + "T00:00:00");
  if (Number.isNaN(start.getTime())) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0 };

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  let hours = now.getHours() - start.getHours();
  let minutes = now.getMinutes() - start.getMinutes();

  if (minutes < 0) { minutes += 60; hours -= 1; }
  if (hours < 0) { hours += 24; days -= 1; }
  if (days < 0) {
    const previousMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += previousMonthDays;
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }
  return { years: Math.max(0, years), months, days, hours, minutes };
}

function updateTogetherTimer() {
  const start = state.couple?.startDate;
  if (!start) return;
  const parts = relationshipTimeParts(start);
  const units = [
    [parts.years, "years"],
    [parts.months, "months"],
    [parts.days, "days"],
    [parts.hours, "hours"],
    [parts.minutes, "minutes"]
  ];
  $("#togetherTimer").innerHTML = `
    <span class="love-time-title">⌛ Time Together</span>
    <div class="love-clock" aria-label="Time together">
      ${units.map(([value, label]) => `<div class="love-clock-cell"><b>${String(value).padStart(2, "0")}</b><small>${label}</small></div>`).join("")}
    </div>
  `;
}
setInterval(updateTogetherTimer, 60000);

function renderActiveSection() {
  if (!state.couple) return;
  renderPersistentPlayer();
  if (state.activeSection === "home") {
    $("#dashboardView")?.classList.remove("feature-mode");
    $("#homeHub")?.classList.remove("hidden");
    $("#sectionShell")?.classList.add("hidden");
    return;
  }
  $("#dashboardView")?.classList.add("feature-mode");
  $("#homeHub")?.classList.add("hidden");
  $("#sectionShell")?.classList.remove("hidden");
  const item = navItems.find(i => i.id === state.activeSection) || navItems[0];
  $("#sectionEyebrow").textContent = item.sub;
  $("#sectionTitle").innerHTML = `${item.iconHtml ? item.iconHtml.replace('nav-svg-icon', 'section-svg-icon') : escapeHtml(item.icon)} ${escapeHtml(item.title)}`;
  const renderers = {
    routine: renderRoutine,
    memories: renderMemories,
    progress: renderProgress,
    timers: renderTimers,
    letters: renderLetters,
    wishlist: renderWishlist,
    dateIdeas: renderDateIdeas,
    gratitude: renderGratitude,
    dreams: renderDreams,
    rescue: renderRescue,
    azkar: renderAzkar,
    timeline: renderTimeline,
    mood: renderMood,
    music: renderMusic,
    surprise: renderSurprises,
    places: renderPlaces,
    quiz: renderQuiz,
    thisOrThat: renderThisOrThat,
    goodNight: renderGoodNight,
    sameMoment: renderSameMoment,
    sky: renderSky,
    plant: renderPlant
  };
  $("#sectionContent").innerHTML = renderers[state.activeSection]?.() || "";
  bindSectionEvents();
  enhanceImageInputs($("#sectionContent"));
}

function emptyState(text = "Start by adding your first item.") {
  return `<div class="empty-state"><span>🤍</span><h3>Nothing here yet</h3><p>${escapeHtml(text)}</p></div>`;
}

async function markActivity(kind = "general") {
  if (!state.coupleId || !uid()) return;
  await setDoc(doc(db, "couples", state.coupleId, "activity", todayKey()), {
    date: todayKey(),
    members: { [uid()]: true },
    kinds: { [uid()]: arrayUnion(kind) },
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function calculateStreak() {
  const memberIds = state.couple?.memberIds || [];
  if (!memberIds.length) return 0;
  const map = Object.fromEntries(state.data.activity.map(a => [a.date, a]));
  let cursor = new Date();
  let count = 0;
  const todayDoc = map[todayKey(cursor)];
  const todayComplete = todayDoc && memberIds.every(id => todayDoc.members?.[id]);
  if (!todayComplete) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 500; i++) {
    const key = todayKey(cursor);
    const docData = map[key];
    const complete = docData && memberIds.every(id => docData.members?.[id]);
    if (!complete) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

async function restoreStreak() {
  const used = state.couple?.restoresUsed?.[uid()] || 0;
  if (used >= 3) return showToast("You have used all your streak restores.");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const membersMap = Object.fromEntries((state.couple?.memberIds || []).map(id => [id, true]));
  await setDoc(doc(db, "couples", state.coupleId, "activity", todayKey(yesterday)), {
    date: todayKey(yesterday),
    members: membersMap,
    restoredBy: arrayUnion(uid()),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await updateDoc(doc(db, "couples", state.coupleId), { [`restoresUsed.${uid()}`]: used + 1 });
  showToast("Yesterday has been restored.");
}

function renderRoutine() {
  const suggestions = routineSuggestions.map(([title, category, metric]) => `<button data-routine-suggestion="${escapeHtml(title)}" data-cat="${category}" data-metric="${metric}">${escapeHtml(title)}</button>`).join("");
  const memberPanels = coupleMembers().map(member => {
    const items = state.data.routines.filter(r => r.ownerUid === member.id);
    return `<div class="owner-panel routine-owner-panel">
      <div class="panel-title-row"><div><p class="eyebrow">Daily plan</p><h3>${member.id === uid() ? "My Routine" : `${escapeHtml(member.name || "Partner")}'s Routine`}</h3></div><span class="routine-count">${items.length}</span></div>
      ${items.length ? `<div class="list">${items.map(renderRoutineItem).join("")}</div>` : emptyState("Each person builds a private routine list. Both partners can view progress.")}
    </div>`;
  }).join("");

  return `
    <div class="card glass routine-builder" style="margin-bottom:18px">
      <div class="builder-heading"><div><p class="eyebrow">Build your day</p><h3>Add a timed routine</h3></div><span class="builder-badge">Daily reset</span></div>
      <p class="form-hint">Every routine resets each day. At the selected time, Grow Together reminds you until you mark it Done or Not Today.</p>
      <div class="suggestions">${suggestions}</div>
      <form id="routineForm" class="routine-form-grid">
        <div class="wide"><label>Routine name</label><input id="routineTitle" required placeholder="Prayer, gym, coding, water..." /></div>
        <div><label>Category</label><select id="routineCategory">
          <option value="prayer">Prayer</option><option value="gym">Gym</option><option value="programming">Programming</option>
          <option value="water">Water</option><option value="challenge">Challenge</option><option value="learning">Learning</option><option value="health">Health</option><option value="custom">Custom</option>
        </select></div>
        <div><label>Tracking</label><select id="routineMetric"><option value="check">Done / Not done</option><option value="hours">Hours</option><option value="count">Count</option></select></div>
        <div><label>Reminder time</label><input id="routineReminderTime" type="time" required /></div>
        <div><label>Repeat until answered</label><select id="routineReminderInterval"><option value="15">Every 15 min</option><option value="30" selected>Every 30 min</option><option value="60">Every hour</option><option value="120">Every 2 hours</option></select></div>
        <label class="toggle-field"><input id="routineReminderEnabled" type="checkbox" checked /><span>Push reminder enabled</span></label>
        <button class="primary routine-add-btn" type="submit">Add to My Day</button>
      </form>
    </div>
    <div class="owner-grid routine-owner-grid">${memberPanels}</div>
  `;
}

function renderRoutineItem(item) {
  const log = item.logs?.[todayKey()] || {};
  const status = log.status || (log.done ? "done" : "pending");
  const done = status === "done";
  const skipped = status === "skipped";
  const value = Number(log.value || 0);
  const isMine = item.ownerUid === uid();
  const time = item.reminderTime || "No time";
  const interval = Number(item.reminderInterval || 30);
  const statusText = done ? "Done today" : skipped ? "Not today" : "Waiting for your check-in";
  return `<article class="item routine-item ${done ? "is-done" : skipped ? "is-skipped" : "is-pending"}">
    <div class="item-header">
      <div class="routine-main-copy">
        <div class="routine-icon">${routineCategoryIcon(item.category)}</div>
        <div><p class="item-title">${escapeHtml(item.title)}</p><div class="meta"><span>⏰ ${escapeHtml(time)}</span><span>↻ ${interval} min</span><span>${item.metric === "hours" ? "Hours" : item.metric === "count" ? "Count" : "Check"}</span></div></div>
      </div>
      ${isMine ? `<button class="ghost compact-danger" data-delete-routine="${item.id}">Delete</button>` : ""}
    </div>
    ${item.metric !== "check" ? `<div class="routine-value-row"><label>Today's value</label><input class="number-input" type="number" min="0" step="0.25" value="${value}" data-routine-value="${item.id}" ${isMine ? "" : "disabled"} /></div>` : ""}
    <div class="routine-status-row">
      <span class="routine-status ${status}">${statusText}</span>
      ${isMine ? `<div class="routine-actions"><button class="routine-action done-action ${done ? "selected" : ""}" data-routine-status="${item.id}" data-status="done">✓ Done</button><button class="routine-action skip-action ${skipped ? "selected" : ""}" data-routine-status="${item.id}" data-status="skipped">– Not Today</button>${status !== "pending" ? `<button class="routine-action reset-action" data-routine-status="${item.id}" data-status="pending">Reset</button>` : ""}</div>` : ""}
    </div>
  </article>`;
}

function routineCategoryIcon(category = "custom") {
  return ({ prayer: "🤲", gym: "🏋️", programming: "💻", water: "💧", challenge: "🔥", learning: "📚", health: "🌿", custom: "✨" })[category] || "✨";
}

function renderMemories() {
  return `
    <form id="memoryForm" class="card glass" style="margin-bottom:16px">
      <h3>Add a photo, video, or note from your day</h3>
      <div class="form-row three">
        <div><label>Text / note</label><textarea id="memoryText" placeholder="Something nice happened today..."></textarea></div>
        <div><label>Photo or video</label><input id="memoryFile" type="file" accept="image/*,video/*" /><input id="memoryUrl" style="margin-top:8px" placeholder="Optional image/video link" /></div>
        <button class="primary" type="submit">Add Memory</button>
      </div>
    </form>
    ${state.data.memories.length ? `<div class="memory-grid">${state.data.memories.map(m => `
      <div class="item memory-card">
        ${m.fileUrl ? mediaTag(m.fileUrl, m.fileType) : ""}
        <p>${escapeHtml(m.text || "")}</p>
        <div class="meta"><span>${escapeHtml(memberName(m.ownerUid))}</span><span>${formatDate(m.date || todayKey())}</span></div>
        ${m.ownerUid === uid() ? `<button class="ghost" data-delete-memory="${m.id}">Delete</button>` : ""}
      </div>`).join("")}</div>` : emptyState("Add your first photo or sweet moment.")}
  `;
}

function mediaTag(url, type = "") {
  if (type.startsWith("video") || /\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video class="timeline-img" src="${escapeHtml(url)}" controls></video>`;
  return `<img src="${escapeHtml(url)}" alt="uploaded memory" />`;
}

function renderProgress() {
  const stats = getRoutineStats();
  return `
    <div class="stats-grid">
      <div class="stat"><strong>${stats.prayerDays}</strong><span>Prayer days</span></div>
      <div class="stat"><strong>${stats.gymDays}</strong><span>Gym days</span></div>
      <div class="stat"><strong>${stats.programmingHours}</strong><span>Programming hours</span></div>
      <div class="stat"><strong>${stats.waterWeeks}</strong><span>Water-goal weeks</span></div>
      <div class="stat"><strong>${stats.mohammedChallenges}</strong><span>Successful challenge days</span></div>
    </div>
    <div class="card glass" style="margin-top:16px">
      <h3>Routine details</h3>
      ${state.data.routines.length ? `<div class="list">${state.data.routines.map(r => {
        const logs = Object.values(r.logs || {}).filter(l => l.done);
        return `<div class="item"><div class="item-header"><p class="item-title">${escapeHtml(r.title)}</p><strong>${logs.length} days</strong></div><div class="meta"><span>${escapeHtml(memberName(r.ownerUid))}</span><span>${escapeHtml(r.category)}</span></div></div>`;
      }).join("")}</div>` : emptyState("Add routines first to see achievements.")}
    </div>
  `;
}

function getRoutineStats() {
  const prayer = new Set(), gym = new Set(), waterWeeks = new Set();
  let programmingHours = 0, mohammedChallenges = 0;
  state.data.routines.forEach(r => {
    Object.entries(r.logs || {}).forEach(([date, log]) => {
      if (!log?.done) return;
      if (r.category === "prayer") prayer.add(date);
      if (r.category === "gym") gym.add(date);
      if (r.category === "water") waterWeeks.add(isoWeek(date));
      if (r.category === "programming") programmingHours += Number(log.value || 1);
      if (r.category === "challenge" && memberName(r.ownerUid).includes("Mohammed")) mohammedChallenges++;
    });
  });
  return { prayerDays: prayer.size, gymDays: gym.size, programmingHours: Math.round(programmingHours * 10) / 10, waterWeeks: waterWeeks.size, mohammedChallenges };
}

function renderTimers() {
  const audienceOptions = [`<option value="both">Both partners</option>`, ...coupleMembers().map(member => `<option value="${member.id}">${escapeHtml(member.name || "Partner")}</option>`)].join("");
  return `
    <form id="eventForm" class="card glass" style="margin-bottom:16px">
      <h3>Add an event</h3>
      <div class="form-row">
        <div><label>Event name</label><input id="eventTitle" required placeholder="Birthday / Anniversary / Graduation" /></div>
        <div><label>First date</label><input id="eventDate" type="date" required /></div>
        <div><label>Icon</label><input id="eventIcon" placeholder="🎉" maxlength="4" /></div>
        <div><label>Color</label><input id="eventColor" type="color" value="#ff8fc7" /></div>
      </div>
      <div class="form-row">
        <div><label>Event type</label><select id="eventType"><option value="anniversary">Anniversary</option><option value="birthday">Birthday</option><option value="engagement">Engagement</option><option value="wedding">Wedding</option><option value="graduation">Graduation</option><option value="trip">Travel / Trip</option><option value="other">Other</option></select></div>
        <div><label>Repeat</label><select id="eventRecurrence"><option value="annual">Every year</option><option value="none">One time only</option></select></div>
        <div><label>Celebrate</label><select id="eventAudience">${audienceOptions}</select></div>
        <div><label>Celebration song</label><input id="eventSongFile" type="file" accept="audio/*" /><input id="eventSongUrl" style="margin-top:8px" placeholder="Or direct audio link" /></div>
      </div>
      <label>Optional description</label><textarea id="eventDescription" placeholder="Any details..."></textarea>
      <div class="inline-actions"><button class="primary" type="submit">Add Timer</button><button id="notificationBtn" type="button" class="ghost">Enable Notifications</button></div>
      <p class="form-hint">Birthdays and anniversaries can repeat automatically every year. Push reminders are sent 7, 3, and 1 day before, and on the event day after Cloud Functions are deployed.</p>
    </form>
    ${state.data.events.length ? `<div class="list">${state.data.events.map(renderEventCard).join("")}</div>` : emptyState("Add your first important event.")}
  `;
}

function renderEventCard(event) {
  const counts = getEventCounts(event);
  const recurrenceLabel = eventRecurrence(event) === "annual" ? "Repeats every year" : "One-time event";
  return `<div class="item timer-card" style="border-inline-start-color:${event.color || "#ff8fc7"}">
    <div class="item-header"><div><p class="item-title">${escapeHtml(event.icon || "⏳")} ${escapeHtml(event.title)}</p><small>${formatDate(event.date)} · ${recurrenceLabel}</small></div>${event.ownerUid === uid() ? `<button class="ghost" data-delete-event="${event.id}">Delete</button>` : ""}</div>
    <p>${escapeHtml(event.description || "")}</p>
    ${counts.isToday ? `<div class="today-celebration">🎊 Today is your special day — open the full cinematic celebration!</div>` : ""}
    <div class="countdown"><div><small>⏳ Next occurrence</small><b>${counts.until}</b></div><div><small>📆 Your story</small><b>${counts.since}</b></div></div>
    <div class="meta"><span>Next date: ${formatDate(counts.nextDateKey)}</span><span>Celebration: ${event.celebrationFor && event.celebrationFor !== "both" ? escapeHtml(memberName(event.celebrationFor)) : "Both partners"}</span>${eventRecurrence(event) === "annual" ? `<span>${counts.years} year${counts.years === 1 ? "" : "s"} since the first date</span>` : ""}</div>
    <div class="inline-actions" style="margin-top:12px"><button class="small-btn" data-celebrate-event="${event.id}">Open Celebration 🎆</button></div>
  </div>`;
}

function getEventCounts(event) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const next = nextEventOccurrence(event, now);
  const original = parseLocalDate(event?.date);
  if (!next || !original) return { until: "No date", since: "No date", isToday: false, nextDateKey: event?.date || "", years: 0 };
  const diffDays = Math.round((next - today) / 86400000);
  const years = eventYearsSince(event, next);
  const nextDateKey = todayKey(next);
  if (eventRecurrence(event) === "annual") {
    return {
      until: diffDays === 0 ? "Today 🎉" : `${diffDays} day${diffDays === 1 ? "" : "s"}`,
      since: years === 0 ? "First celebration" : `${years} year${years === 1 ? "" : "s"} together with this memory`,
      isToday: diffDays === 0,
      nextDateKey,
      years
    };
  }
  if (diffDays > 0) return { until: `${diffDays} day${diffDays === 1 ? "" : "s"}`, since: "Not yet", isToday: false, nextDateKey, years: 0 };
  if (diffDays === 0) return { until: "Today 🎉", since: "Today 🎉", isToday: true, nextDateKey, years: 0 };
  return { until: "Arrived 🎉", since: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`, isToday: false, nextDateKey, years: 0 };
}

function renderLetters() {
  return `
    <form id="letterForm" class="card glass" style="margin-bottom:16px">
      <h3>Future Letter</h3>
      <div class="form-row three">
        <div><label>Title</label><input id="letterTitle" required placeholder="Open it after one year" /></div>
        <div><label>Opens on</label><input id="letterOpenDate" type="date" required /></div>
        <div><label>For whom?</label><select id="letterRecipient"><option value="both">Both of us</option><option value="self">Myself</option><option value="partner">My partner</option></select></div>
      </div>
      <label>Message</label><textarea id="letterBody" required placeholder="Write a sweet message..."></textarea>
      <button class="primary" type="submit">Save Letter</button>
    </form>
    ${state.data.letters.length ? `<div class="list">${state.data.letters.map(l => {
      const open = new Date(l.openDate + "T00:00:00") <= new Date();
      return `<div class="item"><div class="item-header"><div><p class="item-title">💌 ${escapeHtml(l.title)}</p><small>Opens: ${formatDate(l.openDate)}</small></div>${l.ownerUid === uid() ? `<button class="ghost" data-delete-letter="${l.id}">Delete</button>` : ""}</div>${open ? `<p>${escapeHtml(l.body)}</p>` : `<div class="surprise-lock">🔒 Locked until ${formatDate(l.openDate)}</div>`}<div class="meta"><span>${escapeHtml(memberName(l.ownerUid))}</span><span>${escapeHtml(l.recipient)}</span></div></div>`;
    }).join("")}</div>` : emptyState("Write a letter to open after a month or a year.")}
  `;
}

function renderWishlist() {
  return `
    <form id="wishForm" class="form-row three card glass" style="margin-bottom:16px">
      <div><label>Wish</label><input id="wishTitle" required placeholder="Trip / Restaurant / Skill" /></div>
      <div><label>Details</label><input id="wishDescription" placeholder="Short description" /></div>
      <button class="primary" type="submit">Add</button>
    </form>
    ${state.data.wishes.length ? `<div class="list">${state.data.wishes.map(w => `<div class="item"><div class="item-header"><div><p class="item-title">${w.completed ? "✅" : "🌙"} ${escapeHtml(w.title)}</p><p>${escapeHtml(w.description || "")}</p><div class="meta"><span>${escapeHtml(memberName(w.ownerUid))}</span></div></div><div class="inline-actions"><button class="small-btn" data-toggle-wish="${w.id}">${w.completed ? "Undo" : "Complete"}</button>${w.ownerUid === uid() ? `<button class="ghost" data-delete-wish="${w.id}">Delete</button>` : ""}</div></div></div>`).join("")}</div>` : emptyState("Add your shared wishes.")}
  `;
}

function renderDateIdeas() {
  return `<div class="card glass"><h3>Random Date Ideas</h3><p class="lead">Includes many ideas: movies, series, games, home activities, deep talks, and weekly goals.</p><button id="randomIdeaBtn" class="primary">Pick an idea 🎲</button><div id="ideaResult" class="quote" style="margin-top:16px">Tap the button and let the app choose.</div></div>`;
}

function renderGratitude() {
  return `
    <form id="gratitudeForm" class="card glass" style="margin-bottom:16px">
      <h3>Gratitude Box</h3>
      <label>Something I am grateful for or liked in my partner</label><textarea id="gratitudeText" required placeholder="Today I am grateful for..."></textarea>
      <button class="primary" type="submit">Save Gratitude</button>
    </form>
    ${state.data.gratitude.length ? `<div class="list">${state.data.gratitude.map(g => `<div class="item"><p>${escapeHtml(g.text)}</p><div class="meta"><span>${escapeHtml(memberName(g.ownerUid))}</span><span>${formatDate(g.date)}</span></div>${g.ownerUid === uid() ? `<button class="ghost" data-delete-gratitude="${g.id}">Delete</button>` : ""}</div>`).join("")}</div>` : emptyState("Write your first gratitude for today.")}
  `;
}

function renderDreams() {
  return `
    <form id="dreamForm" class="card glass" style="margin-bottom:16px">
      <h3>Dream Board</h3>
      <div class="form-row three">
        <div><label>Title</label><input id="dreamTitle" required placeholder="Dream house / Target body" /></div>
        <div><label>Category</label><select id="dreamCategory"><option>Dream House</option><option>Target Body</option><option>Target Career</option><option>Programming Level</option><option>Life We Want</option><option>Other</option></select></div>
        <div><label>Photo/background</label><input id="dreamFile" type="file" accept="image/*" /><input id="dreamImageUrl" style="margin-top:8px" placeholder="Or image link" /></div>
      </div>
      <label>Description</label><textarea id="dreamDescription" placeholder="Describe the dream..."></textarea>
      <button class="primary" type="submit">Add Dream Card</button>
    </form>
    ${state.data.dreams.length ? `<div class="cards-grid">${state.data.dreams.map(d => `<div class="item dream-card">${d.imageUrl ? `<img src="${d.imageUrl}" alt="dream" />` : ""}<h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.description || "")}</p><div class="meta"><span>${escapeHtml(d.category)}</span><span>${escapeHtml(memberName(d.ownerUid))}</span></div>${d.ownerUid === uid() ? `<button class="ghost" data-delete-dream="${d.id}">Delete</button>` : ""}</div>`).join("")}</div>` : emptyState("Create your first dream card.")}
  `;
}

function renderRescue() {
  return `<div class="card glass"><h3>Quick Rescue</h3><p class="lead">If your day is rough, tap for a simple reset idea.</p><button id="rescueBtn" class="primary icon-button">${rescueIconSvg("inline-svg-icon")} Rescue the Day</button><div id="rescueResult" class="quote" style="margin-top:16px">A quick suggestion appears here.</div></div>`;
}

function renderAzkar() {
  const groupTitles = { morning: "Morning Reminders", evening: "Evening Reminders", sleep: "Sleep Reminders" };
  const log = state.data.azkarLogs.find(l => l.id === `${uid()}_${todayKey()}`) || {};
  const counts = log.counts || {};
  return `<div class="azkar-box">${Object.entries(azkarGroups).map(([group, list]) => `<div class="zekr-card"><h3>${groupTitles[group]}</h3>${list.map((z, index) => {
    const key = `${group}_${index}`;
    const count = counts[key] || 0;
    return `<div class="item"><p>${escapeHtml(z.text)}</p><div class="done-row"><strong>${count}/${z.target}</strong><button class="small-btn" data-zekr-key="${key}" data-zekr-target="${z.target}">+1</button></div></div>`;
  }).join("")}</div>`).join("")}</div>`;
}

function renderTimeline() {
  const combined = [];
  if (state.couple?.startDate) combined.push({ title: "The day you became together", date: state.couple.startDate, icon: "🤍", description: "The beginning of the story.", source: "system" });
  state.data.memories.forEach(memory => combined.push({ title: "Memory", date: memory.date, icon: "📸", description: memory.text, imageUrl: memory.fileType?.startsWith("image") ? memory.fileUrl : "", source: "memory" }));
  state.data.events.forEach(event => combined.push({ title: event.title, date: event.date, icon: event.icon || "⏳", description: event.description, source: "event" }));
  state.data.timelineEvents.forEach(item => combined.push({ ...item, icon: item.icon || "🕊️", source: "timeline" }));
  combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return `
    <form id="timelineForm" class="card glass" style="margin-bottom:16px">
      <h3>Add a Timeline Event</h3>
      <div class="form-row">
        <div><label>Title</label><input id="timelineTitle" required placeholder="Achievement / Memory / Event" /></div>
        <div><label>Date</label><input id="timelineDate" type="date" required /></div>
        <div><label>Icon</label><input id="timelineIcon" maxlength="4" placeholder="🕊️" /></div>
        <div><label>Photo</label><input id="timelineFile" type="file" accept="image/*" /><input id="timelineImageUrl" style="margin-top:8px" placeholder="Or image link" /></div>
      </div>
      <label>Description</label><textarea id="timelineDescription"></textarea>
      <button class="primary" type="submit">Add to Timeline</button>
    </form>
    ${combined.length ? `<div class="timeline">${combined.map(item => `<div class="timeline-item">${item.imageUrl ? `<img class="timeline-img" src="${escapeHtml(item.imageUrl)}" alt="timeline" />` : ""}<div class="item-header"><div><h3>${escapeHtml(item.icon || "•")} ${escapeHtml(item.title)}</h3><small>${formatDate(item.date)}</small></div>${item.source === "timeline" && item.ownerUid === uid() ? `<button class="ghost" data-delete-timeline="${item.id}">Delete</button>` : ""}</div><p>${escapeHtml(item.description || "")}</p></div>`).join("")}</div>` : emptyState("The timeline will collect memories, events, and achievements.")}
  `;
}

function renderMood() {
  const moods = ["😊 Happy", "😌 Calm", "😔 Sad", "😤 Stressed", "😴 Tired"];
  const today = state.data.moodToday || {};
  const choices = today.choices || {};
  const myMood = choices[uid()]?.mood;
  const allPicked = (state.couple?.memberIds || []).every(id => choices[id]?.mood);
  let result = "";
  if (!myMood) result = `<div class="quote">Choose your mood today. Your partner’s mood stays hidden until both of you choose.</div>`;
  else if (!allPicked) result = `<div class="quote">Your mood is saved. Waiting for your partner 🤍</div>`;
  else {
    const rows = Object.entries(choices).map(([id, v]) => `<div class="item"><strong>${escapeHtml(memberName(id))}</strong><p>${escapeHtml(v.mood)}</p></div>`).join("");
    result = `<h3>Today’s Emotional Match</h3><div class="grid two">${rows}</div><div class="quote" style="margin-top:12px">${moodSuggestion(choices)}</div>`;
  }
  return `<div class="card glass"><h3>Mood Sync</h3><div class="mood-grid">${moods.map(m => `<button class="mood-btn ${myMood === m ? "active" : ""}" data-mood="${m}"><span>${m.split(" ")[0]}</span>${m.split(" ").slice(1).join(" ")}</button>`).join("")}</div><div style="margin-top:16px">${result}</div></div>`;
}

function moodSuggestion(choices) {
  const values = Object.values(choices).map(v => v.mood);
  if (values.some(v => v.includes("Sad") || v.includes("Stressed")) && values.some(v => v.includes("Happy") || v.includes("Calm"))) return "One of you needs extra kindness today: send them a sweet message.";
  if (values.every(v => v.includes("Happy") || v.includes("Calm"))) return "Your energy matches nicely today. Use it for a small goal or a light date.";
  if (values.every(v => v.includes("Tired"))) return "Today is a rest day. Lower expectations, drink water, and sleep early.";
  return "Ask each other: what can I do for you today?";
}

function renderMusic() {
  const music = state.data.music;
  const songs = state.data.soundtrack || [];
  const joined = Boolean(music?.sessionId && state.musicSync.joinedSessionId === music.sessionId);
  const keyReady = youtubeConfig?.apiKey && !youtubeConfig.apiKey.startsWith("PASTE_");
  const results = state.musicSearchResults || [];
  return `<div class="card glass music-page-card"><div class="builder-heading"><div><p class="eyebrow">Shared listening</p><h3>Now Playing</h3></div><span class="builder-badge">Persistent player</span></div><p class="lead">Search by song or artist, then play it inside Grow Together. The mini player stays active while you move between sections.</p>
    <form id="musicSearchForm" class="music-search-row">
      <div><label>Search for a song</label><input id="musicSearchQuery" required placeholder="Song title or artist" autocomplete="off" /></div>
      <button class="primary" type="submit">Search</button>
    </form>
    ${keyReady ? "" : `<div class="setup-note"><strong>One-time setup needed:</strong> add a restricted YouTube Data API key in <code>firebase-config.js</code> to enable song search.</div>`}
    <div id="musicSearchResults" class="music-results">${results.length ? results.map(song => `<button type="button" class="music-result" data-youtube-song="${escapeHtml(song.videoId)}"><img src="${escapeHtml(song.thumbnailUrl)}" alt="" /><span><b>${escapeHtml(song.title)}</b><small>${escapeHtml(song.artist)}</small></span><em>Play</em></button>`).join("") : `<p class="form-hint">Search results will appear here.</p>`}</div>
    ${music ? `<div class="item now-playing-card" style="margin-top:16px"><div class="now-playing-head">${music.thumbnailUrl ? `<img src="${escapeHtml(music.thumbnailUrl)}" alt="" />` : ""}<div><h3>🎧 ${escapeHtml(music.title || "Now Playing")}</h3><p>${escapeHtml(music.artist || "")}</p></div></div><div class="meta"><span>Session started by: ${escapeHtml(memberName(music.ownerUid))}</span><span id="musicSyncStatus">${joined ? "Live sync joined" : "Tap Join Live Session"}</span></div><div class="inline-actions"><button id="syncListenBtn" class="small-btn">${joined ? "Re-sync now" : "Join Live Session"}</button><button id="pingMusicBtn" class="ghost">Invite partner again</button></div><p class="form-hint">The player remains visible across the app. Lock-screen/background continuation depends on the mobile browser and YouTube; the app cannot force a browser to keep an embedded YouTube stream alive after the operating system suspends it.</p></div>` : emptyState("Search and choose your first song.")}
    <div class="card glass inner-card" style="margin-top:16px"><h3>Our Soundtrack</h3>${songs.length ? `<div class="list">${songs.map(song => `<div class="item"><div class="item-header"><div class="soundtrack-info">${song.thumbnailUrl ? `<img src="${escapeHtml(song.thumbnailUrl)}" alt="" />` : ""}<div><p class="item-title">🎵 ${escapeHtml(song.title)}</p><p>${escapeHtml(song.artist || "")}</p><div class="meta"><span>${escapeHtml(memberName(song.ownerUid))}</span><span>${song.provider === "youtube" ? "YouTube" : song.audioStoragePath ? "Uploaded audio" : "Linked audio"}</span></div></div></div><div class="inline-actions"><button class="small-btn" data-play-soundtrack="${song.id}">Play live</button>${song.ownerUid === uid() ? `<button class="ghost" data-delete-soundtrack="${song.id}">Delete</button>` : ""}</div></div></div>`).join("")}</div>` : emptyState("Every selected song appears here.")}</div>
  </div>`;
}

function renderSurprises() {
  return `
    <form id="surpriseForm" class="card glass" style="margin-bottom:16px">
      <h3>Secret Surprise</h3>
      <div class="form-row three">
        <div><label>Title</label><input id="surpriseTitle" required placeholder="Small surprise" /></div>
        <div><label>Open time</label><input id="surpriseOpenAt" type="datetime-local" required /></div>
        <div><label>Optional file/link</label><input id="surpriseFile" type="file" accept="image/*,video/*" /><input id="surpriseUrl" style="margin-top:8px" placeholder="Or image/video link" /></div>
      </div>
      <label>Message / Quote</label><textarea id="surpriseText" placeholder="Never forget that..."></textarea>
      <button class="primary" type="submit">Prepare Surprise</button>
    </form>
    ${state.data.surprises.length ? `<div class="list">${state.data.surprises.map(s => {
      const open = new Date(s.openAt) <= new Date();
      return `<div class="item"><div class="item-header"><div><p class="item-title">🎁 ${escapeHtml(s.title)}</p><small>Opens: ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.openAt))}</small></div>${s.ownerUid === uid() ? `<button class="ghost" data-delete-surprise="${s.id}">Delete</button>` : ""}</div>${open ? `<p>${escapeHtml(s.text || "")}</p>${s.fileUrl ? mediaTag(s.fileUrl, s.fileType) : ""}` : `<div class="surprise-lock">🔒 Secret surprise</div>`}<div class="meta"><span>From ${escapeHtml(memberName(s.ownerUid))}</span></div></div>`;
    }).join("")}</div>` : emptyState("Prepare a digital surprise with a specific opening time.")}
  `;
}


function normalizeAnswer(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function renderPlaces() {
  const points = state.data.places.map((place, i) => {
    const x = 8 + ((i * 31) % 82);
    const y = 12 + ((i * 47) % 72);
    return `<button class="map-pin ${place.status === "future" ? "future" : ""}" style="left:${x}%;top:${y}%" title="${escapeHtml(place.title)}">${escapeHtml(place.icon || (place.status === "future" ? "⭐" : "📍"))}</button>`;
  }).join("");
  return `
    <form id="placeForm" class="card glass" style="margin-bottom:16px">
      <h3>Where We Were</h3>
      <p class="lead">Add places you visited or want to visit. The map is symbolic, and Google Maps links open the real location.</p>
      <div class="form-row">
        <div><label>Place name</label><input id="placeTitle" required placeholder="Restaurant / University / Trip" /></div>
        <div><label>Category</label><select id="placeCategory"><option>Restaurant</option><option>University</option><option>Trip</option><option>Cafe</option><option>Important Place</option><option>Country to Visit</option><option>Other</option></select></div>
        <div><label>Status</label><select id="placeStatus"><option value="visited">Visited</option><option value="future">Want to visit</option></select></div>
        <div><label>Date</label><input id="placeDate" type="date" value="${todayKey()}" /></div>
      </div>
      <div class="form-row two">
        <div><label>Optional map link</label><input id="placeMapUrl" placeholder="Google Maps link" /></div>
        <div><label>Place photo</label><input id="placeImageFile" type="file" accept="image/*" /><input id="placeImageUrl" style="margin-top:8px" placeholder="Optional image link" /></div>
      </div>
      <label>Note</label><textarea id="placeNote" placeholder="What happened there, or why do you want to visit it?"></textarea>
      <button class="primary" type="submit">Add Place</button>
    </form>
    <div class="memory-map glass"><div class="map-sky"></div>${points || `<div class="map-empty">No places on the map yet</div>`}</div>
    ${state.data.places.length ? `<div class="cards-grid" style="margin-top:16px">${state.data.places.map(place => `<div class="item dream-card">${place.imageUrl ? `<img src="${escapeHtml(place.imageUrl)}" alt="place" />` : ""}<h3>${escapeHtml(place.icon || (place.status === "future" ? "⭐" : "📍"))} ${escapeHtml(place.title)}</h3><p>${escapeHtml(place.note || "")}</p><div class="meta"><span>${escapeHtml(place.category)}</span><span>${place.status === "future" ? "Want to visit" : "Visited"}</span><span>${formatDate(place.date)}</span><span>${escapeHtml(memberName(place.ownerUid))}</span></div><div class="inline-actions" style="margin-top:10px">${place.mapUrl ? `<a class="small-btn link-btn" href="${escapeHtml(place.mapUrl)}" target="_blank" rel="noopener">Open Map</a>` : ""}${place.ownerUid === uid() ? `<button class="ghost" data-delete-place="${place.id}">Delete</button>` : ""}</div></div>`).join("")}</div>` : emptyState("Add your first meaningful place or future destination.")}
  `;
}

function getQuizStats() {
  const memberIds = state.couple?.memberIds || [];
  const answers = Object.fromEntries(state.data.quizAnswers.map(a => [a.id, a]));
  let total = 0, correct = 0;
  const byUser = Object.fromEntries(memberIds.map(id => [id, { total: 0, correct: 0 }]));
  quizQuestions.forEach(q => {
    memberIds.forEach(id => {
      const other = memberIds.find(x => x !== id);
      if (!other) return;
      const mine = answers[`${q.id}_${id}`];
      const partner = answers[`${q.id}_${other}`];
      if (!mine?.partnerGuess || !partner?.ownAnswer) return;
      total++;
      byUser[id].total++;
      if (normalizeAnswer(mine.partnerGuess) === normalizeAnswer(partner.ownAnswer)) {
        correct++;
        byUser[id].correct++;
      }
    });
  });
  return { total, correct, percent: total ? Math.round((correct / total) * 100) : 0, byUser };
}

function renderQuiz() {
  const stats = getQuizStats();
  const answers = Object.fromEntries(state.data.quizAnswers.map(a => [a.id, a]));
  const options = quizQuestions.map(q => `<option value="${q.id}">${escapeHtml(q.text)}</option>`).join("");
  const rows = quizQuestions.map(q => {
    const mine = answers[`${q.id}_${uid()}`];
    const memberRows = coupleMembers().map(m => {
      const a = answers[`${q.id}_${m.id}`];
      return `<div class="meta"><span>${escapeHtml(m.name || "Partner")}</span><span>${a?.ownAnswer ? "Answered" : "Waiting"}</span></div>`;
    }).join("");
    return `<div class="item"><div class="item-header"><div><p class="item-title">🧩 ${escapeHtml(q.text)}</p>${memberRows}</div><strong>${mine ? "✅" : ""}</strong></div></div>`;
  }).join("");
  return `
    <div class="stats-grid mini-stats">
      <div class="stat"><strong>${stats.percent}%</strong><span>How well you know each other</span></div>
      ${coupleMembers().map(m => { const s = stats.byUser[m.id] || { total: 0, correct: 0 }; return `<div class="stat"><strong>${s.total ? Math.round((s.correct / s.total) * 100) : 0}%</strong><span>${escapeHtml(m.name || "Partner")}</span></div>`; }).join("")}
    </div>
    <form id="quizForm" class="card glass" style="margin:16px 0">
      <h3>Couple Quiz</h3>
      <div class="form-row three">
        <div><label>Question</label><select id="quizQuestion">${options}</select></div>
        <div><label>My real answer</label><input id="quizOwnAnswer" required placeholder="My real answer" /></div>
        <div><label>My guess for my partner</label><input id="quizPartnerGuess" required placeholder="What do you think they would answer?" /></div>
      </div>
      <button class="primary" type="submit">Save Answer</button>
    </form>
    <div class="list">${rows}</div>
  `;
}

function getThisOrThatStats() {
  const docs = Object.fromEntries(state.data.thisOrThatAnswers.map(a => [a.id, a]));
  let both = 0, same = 0;
  thisOrThatQuestions.forEach(q => {
    const choices = docs[q.id]?.choices || {};
    const values = (state.couple?.memberIds || []).map(id => choices[id]).filter(Boolean);
    if (values.length === 2) { both++; if (values[0] === values[1]) same++; }
  });
  return { both, same, percent: both ? Math.round((same / both) * 100) : 0 };
}

function renderThisOrThat() {
  const docs = Object.fromEntries(state.data.thisOrThatAnswers.map(a => [a.id, a]));
  const stats = getThisOrThatStats();
  return `
    <div class="card glass" style="margin-bottom:16px"><h3>This Or That</h3><p class="lead">Choose quickly. Once both answer, your similarity score appears.</p><div class="big-match">${stats.percent}% Similarity</div><small>${stats.same}/${stats.both} matching answers</small></div>
    <div class="cards-grid this-grid">${thisOrThatQuestions.map(q => {
      const choices = docs[q.id]?.choices || {};
      const mine = choices[uid()];
      const partnerPicked = (state.couple?.memberIds || []).filter(id => choices[id]).length;
      const reveal = partnerPicked >= 2;
      return `<div class="item"><h3>${escapeHtml(q.a)} <span class="muted-or">or</span> ${escapeHtml(q.b)}</h3><div class="choice-row"><button class="small-btn ${mine === "a" ? "selected" : ""}" data-this-id="${q.id}" data-this-choice="a">${escapeHtml(q.a)}</button><button class="small-btn ${mine === "b" ? "selected" : ""}" data-this-id="${q.id}" data-this-choice="b">${escapeHtml(q.b)}</button></div>${reveal ? `<div class="meta">${coupleMembers().map(m => `<span>${escapeHtml(m.name || "Partner")}: ${choices[m.id] === "a" ? escapeHtml(q.a) : escapeHtml(q.b)}</span>`).join("")}</div>` : `<small>Both of you need to answer to reveal the choices</small>`}</div>`;
    }).join("")}</div>
  `;
}

function renderGoodNight() {
  const docs = [...state.data.goodNight].sort((a,b) => String(b.id).localeCompare(String(a.id)));
  const today = state.data.goodNight.find(d => d.id === todayKey()) || {};
  const my = today.entries?.[uid()] || {};
  return `
    <form id="goodNightForm" class="card glass" style="margin-bottom:16px">
      <h3>Good Night Capsule 🌙</h3><p class="lead">Before sleep, write the best and hardest part of the day. Your partner sees it the next morning/day.</p>
      <label>Best thing today</label><textarea id="goodNightBest" required placeholder="Best moment today...">${escapeHtml(my.best || "")}</textarea>
      <label>Hardest thing today</label><textarea id="goodNightWorst" required placeholder="Hardest thing today...">${escapeHtml(my.worst || "")}</textarea>
      <button class="primary" type="submit">Save Tonight’s Capsule</button>
    </form>
    ${docs.length ? `<div class="list">${docs.map(d => `<div class="item"><h3>🌙 ${formatDate(d.id)}</h3><div class="grid two">${coupleMembers().map(m => {
      const entry = d.entries?.[m.id];
      const canSee = m.id === uid() || d.id < todayKey();
      return `<div class="item"><strong>${escapeHtml(m.name || "Partner")}</strong>${entry ? (canSee ? `<p><b>Best thing:</b> ${escapeHtml(entry.best)}</p><p><b>Hardest thing:</b> ${escapeHtml(entry.worst)}</p>` : `<div class="surprise-lock">🔒 Opens in the morning</div>`) : `<p>Not written yet</p>`}</div>`;
    }).join("")}</div></div>`).join("")}</div>` : emptyState("Write your first good night capsule.")}
  `;
}

function renderSameMoment() {
  const challengeOptions = state.data.momentChallenges.map(c => `<option value="${c.id}">${formatDate(c.date || todayKey())} - ${escapeHtml(c.title || "Take a photo now")}</option>`).join("");
  return `
    <div class="grid two">
      <div class="card glass"><h3>Same Moment Challenge</h3><p class="lead">Tap send and your partner gets a real push notification, even when the app is closed after push setup. Each partner uploads a photo, and both photos unlock together.</p><button id="createMomentBtn" class="primary">Send Photo Challenge Now 📸</button></div>
      <form id="momentPhotoForm" class="card glass"><h3>Upload your photo</h3><label>Choose challenge</label><select id="momentChallengeId">${challengeOptions}</select><label>Photo file</label><input id="momentPhotoFile" type="file" accept="image/*" /><label>Optional image link</label><input id="momentPhotoUrl" placeholder="https://...jpg" /><label>Optional caption</label><input id="momentCaption" placeholder="What was the moment?" /><button class="primary" type="submit">Save My Photo</button></form>
    </div>
    ${state.data.momentChallenges.length ? `<div class="list" style="margin-top:16px">${state.data.momentChallenges.map(c => {
      const photos = c.photos || {};
      const allUploaded = (state.couple?.memberIds || []).every(id => photos[id]?.url);
      return `<div class="item"><div class="item-header"><div><p class="item-title">📸 ${escapeHtml(c.title || "Take a photo now")}</p><small>${formatDate(c.date || todayKey())}</small></div>${c.ownerUid === uid() ? `<button class="ghost" data-delete-moment="${c.id}">Delete</button>` : ""}</div>${allUploaded ? `<div class="memory-grid">${coupleMembers().map(m => `<div class="memory-card item"><img src="${escapeHtml(photos[m.id]?.url || "")}" alt="same moment" /><p>${escapeHtml(photos[m.id]?.caption || "")}</p><div class="meta"><span>${escapeHtml(m.name || "Partner")}</span></div></div>`).join("")}</div>` : `<div class="surprise-lock">🔒 Unlocks when both photos are uploaded</div>`}</div>`;
    }).join("")}</div>` : emptyState("Start your first same-moment challenge.")}
  `;
}
function todaySky() {
  const index = new Date(todayKey() + "T12:00:00").getDate() % skyMoods.length;
  return skyMoods[index];
}

function renderSky() {
  const sky = todaySky();
  const todayDoc = state.data.skyEntries.find(d => d.id === todayKey()) || {};
  const my = todayDoc.entries?.[uid()] || {};
  const docs = [...state.data.skyEntries].sort((a,b) => String(b.id).localeCompare(String(a.id)));
  return `
    <div class="sky-card" style="background:${sky.gradient}">
      <div><span>${sky.emoji}</span><h3>Today’s Sky</h3><p>Take a real photo of your sky, upload it, and write anything about your day.</p></div>
    </div>
    <form id="skyForm" class="card glass" style="margin:16px 0">
      <h3>Upload today’s sky</h3>
      <div class="form-row three">
        <div><label>Sky photo</label><input id="skyPhotoFile" type="file" accept="image/*" /></div>
        <div><label>Optional image link</label><input id="skyPhotoUrl" placeholder="https://...jpg" value="${escapeHtml(my.imageUrl || "")}" /></div>
        <div><label>How was your day?</label><textarea id="skyText" required placeholder="Write anything about today...">${escapeHtml(my.text || "")}</textarea></div>
      </div>
      ${my.imageUrl ? `<div class="sky-preview"><img src="${escapeHtml(my.imageUrl)}" alt="my sky" /></div>` : ""}
      <div class="inline-actions"><button class="primary" type="submit">Save Today’s Sky</button>${my.imageUrl || my.text ? `<button class="ghost" type="button" data-delete-sky="${todayKey()}">Delete My Sky Entry</button>` : ""}</div>
    </form>
    ${docs.length ? `<div class="list">${docs.map(d => `<div class="item"><h3>☁️ ${formatDate(d.id)}</h3><div class="grid two">${coupleMembers().map(m => {
      const entry = d.entries?.[m.id];
      return `<div class="item memory-card"><strong>${escapeHtml(m.name || "Partner")}</strong>${entry?.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" alt="sky photo" />` : `<div class="surprise-lock">☁️</div>`}<p>${escapeHtml(entry?.text || "Not written yet")}</p></div>`;
    }).join("")}</div></div>`).join("")}</div>` : emptyState("Upload your first real sky photo.")}
  `;
}
function getPlantStats() {
  const activities = state.data.activity.length;
  const memories = state.data.memories.length;
  const gratitude = state.data.gratitude.length;
  const wishesDone = state.data.wishes.filter(w => w.completed).length;
  const routinesDone = state.data.routines.reduce((sum, r) => sum + Object.values(r.logs || {}).filter(l => l.done).length, 0);
  const points = activities * 2 + memories * 3 + gratitude * 2 + wishesDone * 4 + routinesDone;
  const lastActivity = state.data.activity[0]?.date || state.couple?.startDate || todayKey();
  const inactiveDays = Math.max(0, Math.floor((new Date(todayKey() + "T12:00:00") - new Date(lastActivity + "T12:00:00")) / 86400000));
  const adjusted = Math.max(0, points - Math.max(0, inactiveDays - 2) * 3);
  const stages = [0, 1, 2, 3, 4, 5];
  const stageIndex = Math.min(stages.length - 1, Math.floor(adjusted / 20));
  return { points, adjusted, inactiveDays, stage: stages[stageIndex], stageIndex };
}

function renderPlant() {
  const plant = getPlantStats();
  return `<div class="plant-card glass"><div class="plant-pot">${plantIconSvg("plant-stage-svg", plant.stage)}</div><h2>Your Digital Plant</h2><p class="lead">The plant grows when you complete routines, add memories, write gratitude, or finish wishes. If you leave the app for a while, it wilts a little.</p><div class="stats-grid mini-stats"><div class="stat"><strong>${plant.adjusted}</strong><span>Growth Points</span></div><div class="stat"><strong>${plant.inactiveDays}</strong><span>Inactive Days</span></div><div class="stat"><strong>${state.data.memories.length}</strong><span>Memories</span></div><div class="stat"><strong>${state.data.gratitude.length}</strong><span>Gratitude</span></div></div><div class="quote" style="margin-top:16px">${plant.inactiveDays > 2 ? "Your plant needs care today: write gratitude or complete a tiny routine." : "Your plant is happy with your care 🤍"}</div></div>`;
}

function celebrationTheme(event = {}) {
  const themes = {
    birthday: { emoji: "🎂", top: "#ff8fc7", bottom: "#7c3aed", line: "A new year of your beautiful story" },
    anniversary: { emoji: "🤍", top: "#f472b6", bottom: "#6d28d9", line: "Another year of choosing each other" },
    engagement: { emoji: "💍", top: "#fbbf24", bottom: "#db2777", line: "One promise, two hearts, one future" },
    wedding: { emoji: "💒", top: "#f9a8d4", bottom: "#4c1d95", line: "Together is your favorite place" },
    graduation: { emoji: "🎓", top: "#38bdf8", bottom: "#4338ca", line: "Dreams look good on you" },
    trip: { emoji: "✈️", top: "#34d399", bottom: "#2563eb", line: "A new chapter is waiting" },
    other: { emoji: "🎆", top: "#fb7185", bottom: "#7c3aed", line: "Today belongs to your story" }
  };
  return themes[event.type] || themes.other;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function createCelebrationAnimation(canvas, event, names) {
  const ctx = canvas.getContext("2d");
  const theme = celebrationTheme(event);
  const particles = Array.from({ length: 90 }, (_, index) => ({
    x: (index * 137.5) % canvas.width,
    y: (index * 83.7) % canvas.height,
    size: 3 + (index % 7),
    speed: .4 + (index % 5) * .14,
    sway: 10 + (index % 9) * 2,
    phase: index * .72,
    shape: index % 4
  }));
  let running = true;
  let animationFrame = null;
  const started = performance.now();

  function draw(now) {
    if (!running) return;
    const t = (now - started) / 1000;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, theme.top);
    gradient.addColorStop(1, theme.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(canvas.width * .5, canvas.height * .35, 20, canvas.width * .5, canvas.height * .35, canvas.width * .6);
    glow.addColorStop(0, "rgba(255,255,255,.35)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle, index) => {
      const y = (particle.y + t * particle.speed * 80) % (canvas.height + 40) - 20;
      const x = particle.x + Math.sin(t * 1.4 + particle.phase) * particle.sway;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * .8 + index);
      ctx.globalAlpha = .55 + .35 * Math.sin(t + particle.phase);
      ctx.fillStyle = index % 3 === 0 ? "#fff7c2" : index % 3 === 1 ? "#ffffff" : "#ffd1e8";
      if (particle.shape === 0) {
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 1.8);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "white";
    ctx.font = "900 82px Inter, Arial";
    ctx.fillText(theme.emoji, canvas.width / 2, 165 + Math.sin(t * 2) * 8);
    ctx.font = "900 70px Inter, Arial";
    ctx.fillText(String(event.title || "Our Special Day").slice(0, 34), canvas.width / 2, 285);
    ctx.font = "800 46px Inter, Arial";
    ctx.fillStyle = "#fff7d6";
    ctx.fillText(String(names || "You Two").slice(0, 42), canvas.width / 2, 365);
    ctx.shadowBlur = 0;
    ctx.font = "600 28px Inter, Arial";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(theme.line, canvas.width / 2, 430);

    const pulse = 1 + Math.sin(t * 2.4) * .025;
    ctx.translate(canvas.width / 2, 535);
    ctx.scale(pulse, pulse);
    roundedRect(ctx, -300, -55, 600, 110, 55);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "800 30px Inter, Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Growing Together, One Beautiful Day at a Time", 0, 10);
    ctx.restore();

    animationFrame = requestAnimationFrame(draw);
  }
  animationFrame = requestAnimationFrame(draw);
  return () => { running = false; if (animationFrame) cancelAnimationFrame(animationFrame); };
}

async function generateCelebrationVideo(event, canvas, output) {
  if (!canvas.captureStream || !window.MediaRecorder) {
    showToast("This browser cannot create a celebration video. Chrome or Edge is recommended.");
    return;
  }
  const button = $("#generateCelebrationVideo");
  if (button) { button.disabled = true; button.textContent = "Creating 12-second video…"; }
  const stream = canvas.captureStream(30);
  let captureAudio = null;
  let audioContext = null;
  if (event?.songUrl) {
    try {
      captureAudio = new Audio();
      captureAudio.crossOrigin = "anonymous";
      captureAudio.src = event.songUrl;
      captureAudio.loop = true;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(captureAudio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      await audioContext.resume();
      await captureAudio.play();
    } catch (error) {
      console.warn("Celebration audio could not be recorded; creating a silent video.", error);
    }
  }
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  const chunks = [];
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 4_500_000 } : undefined);
  recorder.ondataavailable = eventData => { if (eventData.data?.size) chunks.push(eventData.data); };
  recorder.onstop = () => {
    captureAudio?.pause();
    audioContext?.close().catch(() => {});
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    output.innerHTML = `<h3>Your personalized celebration video</h3><video class="generated-celebration-video" controls src="${url}"></video><a class="primary link-btn" href="${url}" download="${escapeHtml((event.title || "celebration").replace(/[^a-z0-9]+/gi, "-").toLowerCase())}.webm">Save Celebration Video</a>`;
    output.classList.remove("hidden");
    if (button) { button.disabled = false; button.textContent = "Create another video"; }
    showToast("Your personalized celebration video is ready.");
  };
  recorder.start(500);
  setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 12000);
}

function showCelebration(event) {
  const allNames = coupleMembers().map(member => member.name).filter(Boolean).join(" & ") || "You Two";
  const names = event?.celebrationFor && event.celebrationFor !== "both" ? memberName(event.celebrationFor) : allNames;
  const theme = celebrationTheme(event);
  const overlay = document.createElement("div");
  overlay.className = "celebration-overlay";
  overlay.innerHTML = `
    <div class="celebration-card glass cinematic-card">
      <p class="eyebrow">${escapeHtml(event?.type || "special day")} · ${escapeHtml(names)}</p>
      <canvas id="celebrationCanvas" class="celebration-canvas" width="1280" height="720" aria-label="Personalized celebration animation"></canvas>
      <div class="celebration-actions">
        ${event?.songUrl ? `<audio id="celebrationAudio" controls loop src="${escapeHtml(event.songUrl)}"></audio>` : `<button id="playTinyCelebration" class="small-btn">Play celebration sound 🎵</button>`}
        <button id="generateCelebrationVideo" class="small-btn">Create 12-second Video</button>
        <button id="closeCelebration" class="primary">Close Celebration</button>
      </div>
      <div id="celebrationVideoOutput" class="celebration-video-output hidden"></div>
      <p class="form-hint">The video includes both names and the event title. Uploaded Firebase audio can usually be included; some external links block audio recording because of CORS.</p>
    </div>`;
  document.body.appendChild(overlay);
  const canvas = $("#celebrationCanvas", overlay);
  const stopAnimation = createCelebrationAnimation(canvas, event || {}, names);
  const audio = $("#celebrationAudio", overlay);
  audio?.play().catch(() => showToast("Tap the audio player to start the celebration song."));
  $("#generateCelebrationVideo", overlay).addEventListener("click", () => generateCelebrationVideo(event || {}, canvas, $("#celebrationVideoOutput", overlay)));
  $("#closeCelebration", overlay).addEventListener("click", () => {
    stopAnimation();
    audio?.pause();
    overlay.remove();
  });
  $("#playTinyCelebration", overlay)?.addEventListener("click", playTinyCelebration);
}

function maybeAutoCelebrateToday() {
  if (!state.coupleId || !state.couple || document.querySelector(".celebration-overlay")) return;
  const event = state.data.events.find(item => getEventCounts(item).isToday);
  if (!event) return;
  const key = `celebrated:${state.coupleId}:${event.id}:${todayKey()}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  showCelebration(event);
}

function playTinyCelebration() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.frequency.value = freq; oscillator.type = "triangle";
      gain.gain.setValueAtTime(.0001, ctx.currentTime + index * .18);
      gain.gain.exponentialRampToValueAtTime(.22, ctx.currentTime + index * .18 + .03);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + index * .18 + .16);
      oscillator.start(ctx.currentTime + index * .18); oscillator.stop(ctx.currentTime + index * .18 + .18);
    });
  } catch (_) { showToast("The browser blocked the sound. Tap again to play it."); }
}

function bindSectionEvents() {
  const root = $("#sectionContent");
  $("#routineForm", root)?.addEventListener("submit", async e => {
    e.preventDefault();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Hebron";
    await addDoc(collection(db, "couples", state.coupleId, "routines"), {
      ownerUid: uid(), title: $("#routineTitle").value.trim(), category: $("#routineCategory").value,
      metric: $("#routineMetric").value, reminderTime: $("#routineReminderTime").value,
      reminderInterval: Number($("#routineReminderInterval").value || 30),
      reminderEnabled: $("#routineReminderEnabled").checked, timezone, logs: {}, createdAt: serverTimestamp()
    });
    e.target.reset();
    $("#routineReminderEnabled").checked = true;
    $("#routineReminderInterval").value = "30";
    showToast("Timed routine added. Enable notifications to receive reminders in the background.");
  });
  $$('[data-routine-suggestion]', root).forEach(btn => btn.addEventListener("click", () => {
    $("#routineTitle").value = btn.dataset.routineSuggestion;
    $("#routineCategory").value = btn.dataset.cat;
    $("#routineMetric").value = btn.dataset.metric;
  }));
  $$('[data-toggle-routine]', root).forEach(btn => btn.addEventListener("click", () => toggleRoutine(btn.dataset.toggleRoutine)));
  $$('[data-routine-status]', root).forEach(btn => btn.addEventListener("click", () => setRoutineStatus(btn.dataset.routineStatus, btn.dataset.status)));
  $$('[data-routine-value]', root).forEach(input => input.addEventListener("change", () => updateRoutineValue(input.dataset.routineValue, input.value)));
  $$('[data-delete-routine]', root).forEach(btn => btn.addEventListener("click", () => deleteDoc(doc(db, "couples", state.coupleId, "routines", btn.dataset.deleteRoutine))));

  $("#memoryForm", root)?.addEventListener("submit", handleMemorySubmit);
  $$('[data-delete-memory]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("memories", btn.dataset.deleteMemory, ["fileStoragePath", "fileUrl"])));

  $("#eventForm", root)?.addEventListener("submit", handleEventSubmit);
  $("#eventType", root)?.addEventListener("change", event => {
    const recurrence = $("#eventRecurrence", root);
    if (recurrence) recurrence.value = ["birthday", "anniversary"].includes(event.target.value) ? "annual" : "none";
  });
  $("#notificationBtn", root)?.addEventListener("click", requestNotifications);
  $$('[data-delete-event]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("events", btn.dataset.deleteEvent, ["songStoragePath", "songUrl"])));
  $$('[data-celebrate-event]', root).forEach(btn => btn.addEventListener("click", () => showCelebration(state.data.events.find(e => e.id === btn.dataset.celebrateEvent))));

  $("#letterForm", root)?.addEventListener("submit", handleLetterSubmit);
  $$('[data-delete-letter]', root).forEach(btn => btn.addEventListener("click", () => deleteDoc(doc(db, "couples", state.coupleId, "letters", btn.dataset.deleteLetter))));

  $("#wishForm", root)?.addEventListener("submit", handleWishSubmit);
  $$('[data-toggle-wish]', root).forEach(btn => btn.addEventListener("click", () => toggleWish(btn.dataset.toggleWish)));
  $$('[data-delete-wish]', root).forEach(btn => btn.addEventListener("click", () => deleteDoc(doc(db, "couples", state.coupleId, "wishes", btn.dataset.deleteWish))));

  $("#randomIdeaBtn", root)?.addEventListener("click", () => $("#ideaResult").textContent = dateIdeas[Math.floor(Math.random() * dateIdeas.length)]);

  $("#gratitudeForm", root)?.addEventListener("submit", handleGratitudeSubmit);
  $$('[data-delete-gratitude]', root).forEach(btn => btn.addEventListener("click", () => deleteDoc(doc(db, "couples", state.coupleId, "gratitude", btn.dataset.deleteGratitude))));

  $("#dreamForm", root)?.addEventListener("submit", handleDreamSubmit);
  $$('[data-delete-dream]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("dreams", btn.dataset.deleteDream, ["imageStoragePath", "imageUrl"])));

  $("#rescueBtn", root)?.addEventListener("click", () => $("#rescueResult").textContent = rescueIdeas[Math.floor(Math.random() * rescueIdeas.length)]);

  $$('[data-zekr-key]', root).forEach(btn => btn.addEventListener("click", () => incrementZekr(btn.dataset.zekrKey, Number(btn.dataset.zekrTarget))));

  $("#timelineForm", root)?.addEventListener("submit", handleTimelineSubmit);
  $$('[data-delete-timeline]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("timelineEvents", btn.dataset.deleteTimeline, ["imageStoragePath", "imageUrl"])));

  $$('[data-mood]', root).forEach(btn => btn.addEventListener("click", () => setMood(btn.dataset.mood)));

  $("#musicSearchForm", root)?.addEventListener("submit", handleMusicSearch);
  $$('[data-youtube-song]', root).forEach(btn => btn.addEventListener("click", () => startYouTubeSession(btn.dataset.youtubeSong)));
  $("#syncListenBtn", root)?.addEventListener("click", syncListen);
  $("#pingMusicBtn", root)?.addEventListener("click", pingMusic);
  $$('[data-play-soundtrack]', root).forEach(btn => btn.addEventListener("click", () => playSoundtrack(btn.dataset.playSoundtrack)));
  $$('[data-delete-soundtrack]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("soundtrack", btn.dataset.deleteSoundtrack, ["audioStoragePath", "url"])));

  $("#surpriseForm", root)?.addEventListener("submit", handleSurpriseSubmit);
  $$('[data-delete-surprise]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("surprises", btn.dataset.deleteSurprise, ["fileStoragePath", "fileUrl"])));

  $("#placeForm", root)?.addEventListener("submit", handlePlaceSubmit);
  $$('[data-delete-place]', root).forEach(btn => btn.addEventListener("click", () => deleteRecordWithFiles("places", btn.dataset.deletePlace, ["imageStoragePath", "imageUrl"])));

  $("#quizForm", root)?.addEventListener("submit", handleQuizSubmit);
  $$('[data-this-id]', root).forEach(btn => btn.addEventListener("click", () => setThisOrThat(btn.dataset.thisId, btn.dataset.thisChoice)));

  $("#goodNightForm", root)?.addEventListener("submit", handleGoodNightSubmit);

  $("#createMomentBtn", root)?.addEventListener("click", createMomentChallenge);
  $("#momentPhotoForm", root)?.addEventListener("submit", handleMomentPhotoSubmit);
  $$('[data-delete-moment]', root).forEach(btn => btn.addEventListener("click", () => deleteMomentChallenge(btn.dataset.deleteMoment)));

  $("#skyForm", root)?.addEventListener("submit", handleSkySubmit);
  $$('[data-delete-sky]', root).forEach(btn => btn.addEventListener("click", () => deleteMySkyEntry(btn.dataset.deleteSky)));
}


async function handlePlaceSubmit(e) {
  e.preventDefault();
  const uploaded = await uploadFile(selectedFile("#placeImageFile"), "places");
  await addDoc(collection(db, "couples", state.coupleId, "places"), {
    ownerUid: uid(),
    title: $("#placeTitle").value.trim(),
    category: $("#placeCategory").value,
    status: $("#placeStatus").value,
    date: $("#placeDate").value || todayKey(),
    mapUrl: $("#placeMapUrl").value.trim(),
    imageUrl: uploaded.url || $("#placeImageUrl").value.trim(),
    imageStoragePath: uploaded.storagePath || "",
    note: $("#placeNote").value.trim(),
    icon: $("#placeStatus").value === "future" ? "⭐" : "📍",
    createdAt: serverTimestamp()
  });
  await markActivity("place");
  e.target.reset();
  showToast("Place added to the map.");
}

async function handleQuizSubmit(e) {
  e.preventDefault();
  const questionId = $("#quizQuestion").value;
  await setDoc(doc(db, "couples", state.coupleId, "quizAnswers", `${questionId}_${uid()}`), {
    questionId,
    ownerUid: uid(),
    ownAnswer: $("#quizOwnAnswer").value.trim(),
    partnerGuess: $("#quizPartnerGuess").value.trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await markActivity("quiz");
  e.target.reset();
  showToast("Your Couple Quiz answer was saved.");
}

async function setThisOrThat(questionId, choice) {
  await setDoc(doc(db, "couples", state.coupleId, "thisOrThatAnswers", questionId), {
    questionId,
    choices: { [uid()]: choice },
    updatedAt: serverTimestamp()
  }, { merge: true });
  await markActivity("thisOrThat");
}

async function handleGoodNightSubmit(e) {
  e.preventDefault();
  await setDoc(doc(db, "couples", state.coupleId, "goodNight", todayKey()), {
    date: todayKey(),
    entries: { [uid()]: { best: $("#goodNightBest").value.trim(), worst: $("#goodNightWorst").value.trim(), at: new Date().toISOString() } },
    updatedAt: serverTimestamp()
  }, { merge: true });
  await markActivity("goodNight");
  showToast("Tonight’s capsule was saved. Your partner can see it tomorrow.");
}

async function createMomentChallenge() {
  await addDoc(collection(db, "couples", state.coupleId, "momentChallenges"), {
    ownerUid: uid(),
    title: "Take a photo now 📷",
    date: todayKey(),
    photos: {},
    pingMillis: Date.now(),
    createdAt: serverTimestamp()
  });
  await markActivity("sameMoment");
  showToast("Photo challenge created. Cloud Functions will push it to your partner, even when the app is closed.");
}

async function handleMomentPhotoSubmit(e) {
  e.preventDefault();
  const challengeId = $("#momentChallengeId").value;
  if (!challengeId) return showToast("Create a challenge first.");
  const uploaded = await uploadFile(selectedFile("#momentPhotoFile"), "sameMoment");
  const url = uploaded.url || $("#momentPhotoUrl").value.trim();
  if (!url) return showToast("Choose a photo file or paste an image link first.");
  const challenge = state.data.momentChallenges.find(item => item.id === challengeId);
  const previous = challenge?.photos?.[uid()];
  await setDoc(doc(db, "couples", state.coupleId, "momentChallenges", challengeId), {
    photos: { [uid()]: { url, storagePath: uploaded.storagePath || "", fileType: uploaded.type || "image/link", caption: $("#momentCaption").value.trim(), at: new Date().toISOString() } },
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (previous?.storagePath && previous.storagePath !== uploaded.storagePath) await deleteStoredFile(previous.storagePath);
  await markActivity("sameMomentPhoto");
  e.target.reset();
  showToast("Photo saved. It unlocks when both photos are uploaded.");
}

async function handleSkySubmit(e) {
  e.preventDefault();
  const sky = todaySky();
  const uploaded = await uploadFile(selectedFile("#skyPhotoFile"), "sky");
  const currentSkyDoc = state.data.skyEntries.find(item => item.id === todayKey());
  const previous = currentSkyDoc?.entries?.[uid()] || {};
  const typedUrl = $("#skyPhotoUrl")?.value.trim() || "";
  const imageUrl = uploaded.url || typedUrl || previous.imageUrl || "";
  const keepsPreviousUpload = !uploaded.storagePath && (!typedUrl || typedUrl === previous.imageUrl);
  const imageStoragePath = uploaded.storagePath || (keepsPreviousUpload ? previous.imageStoragePath || "" : "");
  await setDoc(doc(db, "couples", state.coupleId, "skyEntries", todayKey()), {
    date: todayKey(),
    sky,
    entries: { [uid()]: { text: $("#skyText").value.trim(), imageUrl, imageStoragePath, fileType: uploaded.type || previous.fileType || "image/link", at: new Date().toISOString() } },
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (previous.imageStoragePath && previous.imageStoragePath !== imageStoragePath) await deleteStoredFile(previous.imageStoragePath);
  await markActivity("sky");
  e.target.reset();
  showToast("Today’s sky photo and note were saved.");
}

async function playSoundtrack(songId) {
  const song = state.data.soundtrack.find(item => item.id === songId);
  if (!song) return;
  const sessionId = randomId("music");
  state.musicSync.joinedSessionId = sessionId;
  await setDoc(doc(db, "couples", state.coupleId, "live", "music"), {
    sessionId,
    ownerUid: uid(),
    controllerUid: uid(),
    title: song.title,
    artist: song.artist || "",
    provider: song.provider || (song.videoId ? "youtube" : "audio"),
    videoId: song.videoId || "",
    thumbnailUrl: song.thumbnailUrl || "",
    url: song.url || "",
    audioStoragePath: song.audioStoragePath || "",
    positionSeconds: 0,
    isPlaying: true,
    playbackRate: 1,
    clientChangedAtMillis: Date.now(),
    changedAt: serverTimestamp(),
    notificationId: randomId("notify"),
    updatedAt: serverTimestamp()
  }, { merge: true });
  showToast("A new live listening session started from Our Soundtrack.");
}

async function toggleRoutine(id) {
  const item = state.data.routines.find(r => r.id === id);
  const current = item?.logs?.[todayKey()] || {};
  await setRoutineStatus(id, current.status === "done" || current.done ? "pending" : "done");
}

async function setRoutineStatus(id, status) {
  const item = state.data.routines.find(r => r.id === id);
  if (!item || item.ownerUid !== uid()) return;
  const current = item.logs?.[todayKey()] || {};
  const normalized = ["done", "skipped", "pending"].includes(status) ? status : "pending";
  await updateDoc(doc(db, "couples", state.coupleId, "routines", id), {
    [`logs.${todayKey()}`]: {
      done: normalized === "done",
      status: normalized,
      value: Number(current.value || (normalized === "done" && item.metric === "hours" ? 1 : 0)),
      at: new Date().toISOString()
    }
  });
  if (normalized === "done") await markActivity("routine");
  showToast(normalized === "done" ? "Routine completed for today ✓" : normalized === "skipped" ? "Marked Not Today. Reminders stopped until tomorrow." : "Routine reset to pending.");
}

async function updateRoutineValue(id, value) {
  const item = state.data.routines.find(r => r.id === id);
  const current = item?.logs?.[todayKey()] || {};
  await updateDoc(doc(db, "couples", state.coupleId, "routines", id), {
    [`logs.${todayKey()}`]: { done: current.status === "done" || current.done || Number(value) > 0, status: current.status || (Number(value) > 0 ? "done" : "pending"), value: Number(value), at: new Date().toISOString() }
  });
  if (Number(value) > 0) await markActivity("routine");
}

function unlockReminderAudio() {
  try {
    state.reminderAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    state.reminderAudioContext.resume?.();
    state.reminderAudioUnlocked = true;
  } catch (_) {}
}

function playRoutineAlarm() {
  try {
    unlockReminderAudio();
    const ctx = state.reminderAudioContext;
    if (!ctx) return;
    const notes = [784, 988, 1175, 988, 1175];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      const startAt = ctx.currentTime + index * .18;
      gain.gain.setValueAtTime(.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(.18, startAt + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, startAt + .15);
      oscillator.start(startAt);
      oscillator.stop(startAt + .17);
    });
    if (navigator.vibrate) navigator.vibrate([160, 80, 160]);
  } catch (_) {}
}

function routineStatusForToday(routine) {
  const log = routine?.logs?.[todayKey()] || {};
  return log.status || (log.done ? "done" : "pending");
}

function checkLocalRoutineReminders() {
  if (!state.user || !state.coupleId) return;
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  state.data.routines.filter(r => r.ownerUid === uid() && r.reminderEnabled !== false && r.reminderTime).forEach(routine => {
    if (["done", "skipped"].includes(routineStatusForToday(routine))) return;
    const [hours, minutes] = String(routine.reminderTime).split(":").map(Number);
    const due = hours * 60 + minutes;
    if (!Number.isFinite(due) || minutesNow < due) return;
    const interval = Math.max(15, Number(routine.reminderInterval || 30));
    const bucket = Math.floor((minutesNow - due) / interval);
    const key = `routine-reminder:${state.coupleId}:${routine.id}:${todayKey()}:${bucket}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
    playRoutineAlarm();
    showToast(`⏰ ${routine.title} — mark it Done or Not Today.`, 8000);
    notify("Routine Reminder ⏰", `${routine.title} is waiting for your check-in.`, { url: `${location.origin}${location.pathname}?section=routine`, routineId: routine.id });
  });
}

function startRoutineReminderEngine() {
  if (state.routineReminderTimer) clearInterval(state.routineReminderTimer);
  state.routineReminderTimer = setInterval(checkLocalRoutineReminders, 30000);
  setTimeout(checkLocalRoutineReminders, 2500);
}

function selectedFile(selectorOrInput) {
  const input = typeof selectorOrInput === "string" ? $(selectorOrInput) : selectorOrInput;
  return input ? (state.capturedFiles.get(input) || input.files?.[0] || null) : null;
}

function enhanceImageInputs(root = document) {
  $$('input[type="file"][accept*="image"]', root).forEach(input => {
    if (input.dataset.cameraEnhanced === "true") return;
    input.dataset.cameraEnhanced = "true";
    input.removeAttribute("capture");
    input.classList.add("native-file-input");

    const chooser = document.createElement("button");
    chooser.type = "button";
    chooser.className = "gallery-trigger ghost";
    chooser.innerHTML = `<span aria-hidden="true">🖼️</span> Choose from Gallery`;
    chooser.addEventListener("click", () => input.click());

    const camera = document.createElement("button");
    camera.type = "button";
    camera.className = "camera-trigger ghost";
    camera.innerHTML = `<span aria-hidden="true">📷</span> Take Photo Now`;
    camera.addEventListener("click", () => openCamera(input));

    const actionRow = document.createElement("div");
    actionRow.className = "photo-source-actions";
    actionRow.append(chooser, camera);
    input.insertAdjacentElement("afterend", actionRow);

    const preview = document.createElement("div");
    preview.className = "captured-file-note hidden";
    input.parentElement?.appendChild(preview);
    input.addEventListener("change", () => {
      state.capturedFiles.delete(input);
      if (input.files?.[0]) {
        preview.textContent = `Selected from gallery: ${input.files[0].name}`;
        preview.classList.remove("hidden");
      }
    });
  });
}

async function openCamera(input) {
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    input.click();
    showToast("Live camera preview is unavailable here. Choose Camera from the device file picker.");
    return;
  }
  try {
    closeCamera();
    state.cameraTarget = input;
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const video = $("#cameraVideo");
    video.srcObject = state.cameraStream;
    $("#cameraModal").classList.remove("hidden");
    $("#cameraVideo").classList.remove("hidden");
    $("#cameraPreview").classList.add("hidden");
    $("#capturePhotoBtn").classList.remove("hidden");
    $("#retakePhotoBtn").classList.add("hidden");
    $("#usePhotoBtn").classList.add("hidden");
    $("#cameraStatus").textContent = "Frame the photo, then tap Take Photo.";
    await video.play();
  } catch (error) {
    console.error("Camera error", error);
    input.click();
    showToast("Camera permission was blocked. Choose a photo from the device picker instead.");
  }
}

function stopCameraStream() {
  state.cameraStream?.getTracks?.().forEach(track => track.stop());
  state.cameraStream = null;
  const video = $("#cameraVideo");
  if (video) video.srcObject = null;
}

function closeCamera() {
  stopCameraStream();
  $("#cameraModal")?.classList.add("hidden");
  state.cameraTarget = null;
}

function captureCameraPhoto() {
  const video = $("#cameraVideo");
  const canvas = $("#cameraCanvas");
  const preview = $("#cameraPreview");
  if (!video?.videoWidth) return showToast("The camera is not ready yet.");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  preview.src = canvas.toDataURL("image/jpeg", .9);
  video.classList.add("hidden");
  preview.classList.remove("hidden");
  $("#capturePhotoBtn").classList.add("hidden");
  $("#retakePhotoBtn").classList.remove("hidden");
  $("#usePhotoBtn").classList.remove("hidden");
  $("#cameraStatus").textContent = "Check the photo. Retake it or confirm that you want to use it.";
}

function retakeCameraPhoto() {
  $("#cameraPreview").classList.add("hidden");
  $("#cameraVideo").classList.remove("hidden");
  $("#capturePhotoBtn").classList.remove("hidden");
  $("#retakePhotoBtn").classList.add("hidden");
  $("#usePhotoBtn").classList.add("hidden");
  $("#cameraStatus").textContent = "Frame the photo, then tap Take Photo.";
}

function confirmCameraPhoto() {
  const input = state.cameraTarget;
  const canvas = $("#cameraCanvas");
  if (!input || !canvas) return;
  canvas.toBlob(blob => {
    if (!blob) return showToast("Could not create the photo file.");
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    state.capturedFiles.set(input, file);
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch (_) {}
    const note = input.parentElement?.querySelector(".captured-file-note");
    if (note) { note.textContent = "Camera photo ready to upload ✓"; note.classList.remove("hidden"); }
    closeCamera();
    showToast("Photo confirmed. Submit the form when you are ready.");
  }, "image/jpeg", .9);
}

async function uploadFile(file, folder) {
  if (!file) return { url: "", type: "", storagePath: "" };
  try {
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storagePath = `couples/${state.coupleId}/${folder}/${uid()}/${safeName}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file, { contentType: file.type || undefined });
    return { url: await getDownloadURL(fileRef), type: file.type, storagePath };
  } catch (err) {
    console.error("Upload failed", err);
    showToast("File upload failed. Check Firebase Storage rules/settings. The text can still be saved without the file.");
    return { url: "", type: "", storagePath: "" };
  }
}

async function deleteStoredFile(storagePathOrUrl) {
  if (!storagePathOrUrl || !storage) return;
  const value = String(storagePathOrUrl);
  if (!value.includes("firebasestorage") && !value.startsWith("gs://") && !value.startsWith("couples/")) return;
  try {
    await deleteObject(ref(storage, value));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") console.warn("Could not delete stored file", value, error);
  }
}

function collectionItem(collectionName, id) {
  const keyMap = { timelineEvents: "timelineEvents", momentChallenges: "momentChallenges", skyEntries: "skyEntries" };
  return (state.data[keyMap[collectionName] || collectionName] || []).find(item => item.id === id);
}

async function deleteRecordWithFiles(collectionName, id, fileFields = []) {
  const item = collectionItem(collectionName, id) || {};
  if (!confirm("Delete this item and its uploaded file permanently?")) return;
  for (const field of fileFields) {
    const value = item[field];
    if (value) await deleteStoredFile(value);
  }
  await deleteDoc(doc(db, "couples", state.coupleId, collectionName, id));
  showToast("Item and uploaded file deleted.");
}

async function deleteMomentChallenge(id) {
  const challenge = state.data.momentChallenges.find(item => item.id === id);
  if (!challenge || !confirm("Delete this challenge and both uploaded photos?")) return;
  for (const photo of Object.values(challenge.photos || {})) {
    await deleteStoredFile(photo.storagePath || photo.url);
  }
  await deleteDoc(doc(db, "couples", state.coupleId, "momentChallenges", id));
  showToast("Challenge and photos deleted.");
}

async function deleteMySkyEntry(dateKey) {
  const skyDoc = state.data.skyEntries.find(item => item.id === dateKey);
  const entry = skyDoc?.entries?.[uid()];
  if (!entry || !confirm("Delete your sky photo and note for this day?")) return;
  await deleteStoredFile(entry.imageStoragePath || entry.imageUrl);
  const partnerEntries = Object.keys(skyDoc.entries || {}).filter(id => id !== uid());
  const skyRef = doc(db, "couples", state.coupleId, "skyEntries", dateKey);
  if (!partnerEntries.length) await deleteDoc(skyRef);
  else await updateDoc(skyRef, { [`entries.${uid()}`]: deleteField(), updatedAt: serverTimestamp() });
  showToast("Your sky entry and uploaded photo were deleted.");
}

async function handleMemorySubmit(e) {
  e.preventDefault();
  const file = selectedFile("#memoryFile");
  const uploaded = await uploadFile(file, "memories");
  const urlFallback = $("#memoryUrl")?.value.trim() || "";
  await addDoc(collection(db, "couples", state.coupleId, "memories"), {
    ownerUid: uid(), text: $("#memoryText").value.trim(), fileUrl: uploaded.url || urlFallback, fileStoragePath: uploaded.storagePath || "", fileType: uploaded.type || (urlFallback.match(/\.(mp4|webm|mov)(\?|$)/i) ? "video/link" : "image/link"),
    date: todayKey(), createdAt: serverTimestamp()
  });
  await markActivity("memory");
  e.target.reset();
}

async function handleEventSubmit(e) {
  e.preventDefault();
  const uploadedSong = await uploadFile(selectedFile("#eventSongFile"), "celebrations");
  const songUrl = uploadedSong.url || $("#eventSongUrl")?.value.trim() || "";
  const eventType = $("#eventType")?.value || "other";
  const recurrence = $("#eventRecurrence")?.value || (["birthday", "anniversary"].includes(eventType) ? "annual" : "none");
  await addDoc(collection(db, "couples", state.coupleId, "events"), {
    ownerUid: uid(), title: $("#eventTitle").value.trim(), date: $("#eventDate").value,
    icon: $("#eventIcon").value || "🎉", color: $("#eventColor").value, type: eventType,
    recurrence, celebrationFor: $("#eventAudience")?.value || "both", songUrl, songStoragePath: uploadedSong.storagePath || "", description: $("#eventDescription").value.trim(),
    createdAt: serverTimestamp()
  });
  e.target.reset();
  showToast("Event added with automatic recurrence and celebration settings.");
}

async function handleLetterSubmit(e) {
  e.preventDefault();
  await addDoc(collection(db, "couples", state.coupleId, "letters"), {
    ownerUid: uid(), title: $("#letterTitle").value.trim(), openDate: $("#letterOpenDate").value,
    recipient: $("#letterRecipient").value, body: $("#letterBody").value.trim(), createdAt: serverTimestamp()
  });
  await markActivity("letter");
  e.target.reset();
}

async function handleWishSubmit(e) {
  e.preventDefault();
  await addDoc(collection(db, "couples", state.coupleId, "wishes"), {
    ownerUid: uid(), title: $("#wishTitle").value.trim(), description: $("#wishDescription").value.trim(),
    completed: false, createdAt: serverTimestamp()
  });
  e.target.reset();
}

async function toggleWish(id) {
  const wish = state.data.wishes.find(w => w.id === id);
  await updateDoc(doc(db, "couples", state.coupleId, "wishes", id), { completed: !wish.completed, completedAt: !wish.completed ? serverTimestamp() : null });
  await markActivity("wish");
}

async function handleGratitudeSubmit(e) {
  e.preventDefault();
  await addDoc(collection(db, "couples", state.coupleId, "gratitude"), {
    ownerUid: uid(), text: $("#gratitudeText").value.trim(), date: todayKey(), createdAt: serverTimestamp()
  });
  await markActivity("gratitude");
  e.target.reset();
}

async function handleDreamSubmit(e) {
  e.preventDefault();
  const uploaded = await uploadFile(selectedFile("#dreamFile"), "dreams");
  await addDoc(collection(db, "couples", state.coupleId, "dreams"), {
    ownerUid: uid(), title: $("#dreamTitle").value.trim(), category: $("#dreamCategory").value,
    description: $("#dreamDescription").value.trim(), imageUrl: uploaded.url || ($("#dreamImageUrl")?.value.trim() || ""), imageStoragePath: uploaded.storagePath || "", createdAt: serverTimestamp()
  });
  e.target.reset();
}

async function incrementZekr(key, target) {
  const id = `${uid()}_${todayKey()}`;
  const refDoc = doc(db, "couples", state.coupleId, "azkarLogs", id);
  const log = state.data.azkarLogs.find(l => l.id === id) || {};
  const current = log.counts?.[key] || 0;
  if (current >= target) return showToast("You finished this counter for today.");
  await setDoc(refDoc, { ownerUid: uid(), date: todayKey(), counts: { [key]: current + 1 }, updatedAt: serverTimestamp() }, { merge: true });
  await markActivity("azkar");
}

async function handleTimelineSubmit(e) {
  e.preventDefault();
  const uploaded = await uploadFile(selectedFile("#timelineFile"), "timeline");
  await addDoc(collection(db, "couples", state.coupleId, "timelineEvents"), {
    ownerUid: uid(), title: $("#timelineTitle").value.trim(), date: $("#timelineDate").value,
    icon: $("#timelineIcon").value || "🕊️", description: $("#timelineDescription").value.trim(), imageUrl: uploaded.url || ($("#timelineImageUrl")?.value.trim() || ""), imageStoragePath: uploaded.storagePath || "",
    createdAt: serverTimestamp()
  });
  e.target.reset();
}

async function setMood(mood) {
  await setDoc(doc(db, "couples", state.coupleId, "mood", todayKey()), {
    date: todayKey(), choices: { [uid()]: { mood, at: new Date().toISOString() } }, updatedAt: serverTimestamp()
  }, { merge: true });
  await markActivity("mood");
}

function musicServerPosition(music = state.data.music) {
  if (!music) return 0;
  const base = Number(music.positionSeconds ?? music.position ?? 0);
  const changedMillis = music.changedAt?.toMillis?.() || Number(music.clientChangedAtMillis || music.lastUpdatedMillis || Date.now());
  const elapsed = music.isPlaying ? Math.max(0, (Date.now() - changedMillis) / 1000) * Number(music.playbackRate || 1) : 0;
  return Math.max(0, base + elapsed);
}

function clearMusicSyncTimers() {
  if (state.musicSync.heartbeat) clearInterval(state.musicSync.heartbeat);
  if (state.musicSync.correction) clearInterval(state.musicSync.correction);
  state.musicSync.heartbeat = null;
  state.musicSync.correction = null;
  if (state.musicSync.youtubePlayer?.destroy) {
    try { state.musicSync.youtubePlayer.destroy(); } catch (_) {}
  }
  state.musicSync.youtubePlayer = null;
  state.musicSync.youtubeReady = false;
  state.musicSync.loadedSessionId = null;
  state.musicSync.loadingSessionId = null;
  const wrapper = $("#dockVideoWrap");
  if (wrapper) wrapper.innerHTML = `<div id="youtubePlayerPersistent" class="youtube-player persistent-youtube-player"></div>`;
}

function updateMusicStatusText() {
  const status = $("#musicSyncStatus");
  if (!status) return;
  const joined = state.data.music?.sessionId && state.musicSync.joinedSessionId === state.data.music.sessionId;
  status.textContent = joined ? `Live sync joined · controlled by ${memberName(state.data.music.controllerUid || state.data.music.ownerUid)}` : "Tap Join Live Session";
}

function isYouTubeSession(music = state.data.music) {
  return music?.provider === "youtube" && Boolean(music.videoId);
}

function currentMusicPosition() {
  if (isYouTubeSession()) return Number(state.musicSync.youtubePlayer?.getCurrentTime?.() || 0);
  return Number($("#sharedAudioPersistent")?.currentTime || 0);
}

function currentMusicPlaying() {
  if (isYouTubeSession()) return state.musicSync.youtubePlayer?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
  const audio = $("#sharedAudioPersistent");
  return Boolean(audio && !audio.paused);
}

function currentMusicRate() {
  if (isYouTubeSession()) return Number(state.musicSync.youtubePlayer?.getPlaybackRate?.() || 1);
  return Number($("#sharedAudioPersistent")?.playbackRate || 1);
}

async function broadcastMusicState({ notifyPartner = false } = {}) {
  const music = state.data.music;
  if (!music?.sessionId || state.musicSync.joinedSessionId !== music.sessionId || state.musicSync.applyingRemote) return;
  if (isYouTubeSession() && !state.musicSync.youtubeReady) return;
  if (!isYouTubeSession() && !$("#sharedAudioPersistent")) return;
  const payload = {
    controllerUid: uid(),
    positionSeconds: currentMusicPosition(),
    isPlaying: currentMusicPlaying(),
    playbackRate: currentMusicRate(),
    clientChangedAtMillis: Date.now(),
    changedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (notifyPartner) payload.notificationId = randomId("notify");
  await updateDoc(doc(db, "couples", state.coupleId, "live", "music"), payload);
}

function applyRemoteMusicState(force = false) {
  const music = state.data.music;
  if (!music || state.musicSync.joinedSessionId !== music.sessionId) return;
  if (!force && music.controllerUid === uid()) return;
  const target = musicServerPosition(music);
  state.musicSync.applyingRemote = true;
  try {
    if (isYouTubeSession(music)) {
      const player = state.musicSync.youtubePlayer;
      if (!player || !state.musicSync.youtubeReady) return;
      const current = Number(player.getCurrentTime?.() || 0);
      if (force || Math.abs(current - target) > 1.1) player.seekTo(target, true);
      if (music.playbackRate && player.setPlaybackRate) player.setPlaybackRate(Number(music.playbackRate || 1));
      const playerState = player.getPlayerState?.();
      if (music.isPlaying && playerState !== window.YT?.PlayerState?.PLAYING) player.playVideo();
      if (!music.isPlaying && playerState === window.YT?.PlayerState?.PLAYING) player.pauseVideo();
    } else {
      const audio = $("#sharedAudioPersistent");
      if (!audio) return;
      const drift = Math.abs(Number(audio.currentTime || 0) - target);
      if (force || drift > .65) audio.currentTime = Math.min(target, Number.isFinite(audio.duration) ? Math.max(0, audio.duration - .15) : target);
      if (music.playbackRate && Math.abs(audio.playbackRate - music.playbackRate) > .01) audio.playbackRate = music.playbackRate;
      if (music.isPlaying && audio.paused) audio.play().catch(() => showToast("Tap Join Live Session again so the browser can allow sound."));
      else if (!music.isPlaying && !audio.paused) audio.pause();
    }
  } finally {
    setTimeout(() => { state.musicSync.applyingRemote = false; }, 650);
  }
}

let youtubeApiPromise = null;
function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { previous?.(); } catch (_) {} resolve(window.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("Could not load the YouTube player."));
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

async function setupYouTubeController(music) {
  await loadYouTubePlayerApi();
  const wrapper = $("#dockVideoWrap");
  if (!wrapper || !music?.videoId) return;
  wrapper.innerHTML = `<div id="youtubePlayerPersistent" class="youtube-player persistent-youtube-player"></div>`;
  state.musicSync.youtubePlayer = new window.YT.Player("youtubePlayerPersistent", {
    width: "220",
    height: "200",
    videoId: music.videoId,
    playerVars: { playsinline: 1, rel: 0, origin: location.origin },
    events: {
      onReady: () => {
        state.musicSync.youtubeReady = true;
        state.musicSync.loadedSessionId = music.sessionId;
        state.musicSync.loadingSessionId = null;
        if (state.musicSync.joinedSessionId === music.sessionId) applyRemoteMusicState(true);
        updateDockPlayButton();
      },
      onStateChange: event => {
        updateDockPlayButton();
        if (state.musicSync.applyingRemote || state.musicSync.joinedSessionId !== music.sessionId) return;
        if ([window.YT.PlayerState.PLAYING, window.YT.PlayerState.PAUSED, window.YT.PlayerState.ENDED].includes(event.data)) {
          broadcastMusicState().catch(error => console.warn("YouTube sync update failed", error));
        }
      },
      onPlaybackRateChange: () => {
        if (!state.musicSync.applyingRemote && state.musicSync.joinedSessionId === music.sessionId) broadcastMusicState().catch(() => {});
      }
    }
  });
}

function setupSharedAudioController() {
  clearMusicSyncTimers();
  const music = state.data.music;
  if (!music?.sessionId) return;
  if (isYouTubeSession(music)) {
    state.musicSync.loadingSessionId = music.sessionId;
    setupYouTubeController(music).catch(error => { state.musicSync.loadingSessionId = null; showToast(error.message); });
  } else {
    state.musicSync.loadedSessionId = music.sessionId;
    const audio = $("#sharedAudioPersistent");
    if (!audio) return;
    audio.src = music.url || "";
    audio.classList.toggle("hidden", !music.url);
    const localAction = () => {
      updateDockPlayButton();
      if (!state.musicSync.applyingRemote && state.musicSync.joinedSessionId === music.sessionId) broadcastMusicState().catch(error => console.warn("Music state update failed", error));
    };
    audio.onplay = localAction;
    audio.onpause = localAction;
    audio.onseeked = localAction;
    audio.onratechange = localAction;
    if (state.musicSync.joinedSessionId === music.sessionId) applyRemoteMusicState(true);
  }
  state.musicSync.correction = setInterval(() => applyRemoteMusicState(false), 1700);
  state.musicSync.heartbeat = setInterval(() => {
    if (state.data.music?.controllerUid === uid() && state.musicSync.joinedSessionId === state.data.music?.sessionId && currentMusicPlaying()) broadcastMusicState().catch(() => {});
  }, 4000);
}

function updateMediaSessionMetadata(music) {
  if (!("mediaSession" in navigator) || !music) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: music.title || "Grow Together",
      artist: music.artist || "Shared listening",
      album: "Our Soundtrack",
      artwork: music.thumbnailUrl ? [{ src: music.thumbnailUrl, sizes: "512x512" }] : []
    });
    navigator.mediaSession.setActionHandler("play", () => toggleDockPlayback(true));
    navigator.mediaSession.setActionHandler("pause", () => toggleDockPlayback(false));
    navigator.mediaSession.setActionHandler("seekbackward", details => seekPersistentMusic(-(details.seekOffset || 10)));
    navigator.mediaSession.setActionHandler("seekforward", details => seekPersistentMusic(details.seekOffset || 10));
  } catch (_) {}
}

function renderPersistentPlayer() {
  const dock = $("#persistentPlayerDock");
  if (!dock) return;
  const music = state.data.music;
  if (!music?.sessionId) {
    dock.classList.add("hidden");
    return;
  }
  dock.classList.remove("hidden");
  $("#dockTitle").textContent = music.title || "Now Playing";
  $("#dockArtist").textContent = music.artist || memberName(music.ownerUid);
  const artwork = $("#dockArtwork");
  artwork.src = music.thumbnailUrl || "./icons/icon-192.png";
  artwork.alt = music.title || "Now Playing";
  $("#dockVideoWrap")?.classList.toggle("hidden", !isYouTubeSession(music));
  $("#sharedAudioPersistent")?.classList.toggle("hidden", isYouTubeSession(music));
  updateMediaSessionMetadata(music);
  const needsSetup = state.musicSync.loadedSessionId !== music.sessionId && state.musicSync.loadingSessionId !== music.sessionId;
  if (needsSetup || (isYouTubeSession(music) && !state.musicSync.youtubePlayer && state.musicSync.loadingSessionId !== music.sessionId)) {
    setupSharedAudioController();
  }
  updateDockPlayButton();
}

function updateDockPlayButton() {
  const button = $("#dockPlayPauseBtn");
  if (!button) return;
  const playing = currentMusicPlaying();
  button.textContent = playing ? "❚❚" : "▶";
  button.setAttribute("aria-label", playing ? "Pause" : "Play");
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
}

function seekPersistentMusic(deltaSeconds) {
  if (!state.data.music?.sessionId) return;
  if (isYouTubeSession()) {
    const player = state.musicSync.youtubePlayer;
    player?.seekTo?.(Math.max(0, Number(player.getCurrentTime?.() || 0) + deltaSeconds), true);
  } else {
    const audio = $("#sharedAudioPersistent");
    if (audio) audio.currentTime = Math.max(0, Number(audio.currentTime || 0) + deltaSeconds);
  }
  broadcastMusicState().catch(() => {});
}

function toggleDockPlayback(forcePlay = null) {
  const music = state.data.music;
  if (!music?.sessionId) return openFeatureSection("music");
  if (state.musicSync.joinedSessionId !== music.sessionId) {
    syncListen();
    return;
  }
  const shouldPlay = forcePlay === null ? !currentMusicPlaying() : Boolean(forcePlay);
  if (isYouTubeSession(music)) {
    if (shouldPlay) state.musicSync.youtubePlayer?.playVideo?.();
    else state.musicSync.youtubePlayer?.pauseVideo?.();
  } else {
    const audio = $("#sharedAudioPersistent");
    if (shouldPlay) audio?.play?.().catch(() => showToast("Tap play once to allow audio on this device."));
    else audio?.pause?.();
  }
  setTimeout(() => broadcastMusicState().catch(() => {}), 120);
  updateDockPlayButton();
}

function decodeYouTubeText(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

async function handleMusicSearch(e) {
  e.preventDefault();
  const queryText = $("#musicSearchQuery")?.value.trim();
  if (!queryText) return;
  if (!youtubeConfig?.apiKey || youtubeConfig.apiKey.startsWith("PASTE_")) return showToast("Add your YouTube Data API key in firebase-config.js first.");
  const resultsBox = $("#musicSearchResults");
  if (resultsBox) resultsBox.innerHTML = `<p class="form-hint">Searching YouTube…</p>`;
  try {
    const params = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", videoEmbeddable: "true", maxResults: "10", safeSearch: "moderate", q: queryText, key: youtubeConfig.apiKey });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "YouTube search failed.");
    state.musicSearchResults = (data.items || []).filter(item => item.id?.videoId).map(item => ({
      videoId: item.id.videoId,
      title: decodeYouTubeText(item.snippet?.title || "Song"),
      artist: decodeYouTubeText(item.snippet?.channelTitle || "YouTube"),
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ""
    }));
    renderActiveSection();
  } catch (error) {
    console.error("YouTube search failed", error);
    state.musicSearchResults = [];
    if (resultsBox) resultsBox.innerHTML = `<p class="form-hint">${escapeHtml(error.message)}</p>`;
    showToast(error.message);
  }
}

async function startYouTubeSession(videoId) {
  const selected = state.musicSearchResults.find(item => item.videoId === videoId) || state.data.soundtrack.find(item => item.videoId === videoId);
  if (!selected) return;
  const sessionId = randomId("music");
  const song = { ownerUid: uid(), provider: "youtube", videoId: selected.videoId, title: selected.title, artist: selected.artist || "", thumbnailUrl: selected.thumbnailUrl || "", url: `https://www.youtube.com/watch?v=${selected.videoId}`, audioStoragePath: "" };
  state.musicSync.joinedSessionId = sessionId;
  await setDoc(doc(db, "couples", state.coupleId, "live", "music"), {
    ...song, sessionId, controllerUid: uid(), positionSeconds: 0, isPlaying: true, playbackRate: 1,
    clientChangedAtMillis: Date.now(), changedAt: serverTimestamp(), notificationId: randomId("notify"), updatedAt: serverTimestamp()
  }, { merge: true });
  const exists = state.data.soundtrack.some(item => item.videoId === song.videoId);
  if (!exists) await addDoc(collection(db, "couples", state.coupleId, "soundtrack"), { ...song, createdAt: serverTimestamp() });
  await markActivity("music");
  showToast("Live YouTube session started. Tap Join Live Session if playback does not begin automatically.");
}
async function pingMusic() {
  if (!state.data.music?.sessionId) return;
  await updateDoc(doc(db, "couples", state.coupleId, "live", "music"), {
    ownerUid: uid(),
    notificationId: randomId("notify"),
    updatedAt: serverTimestamp()
  });
  showToast("A new push invitation was sent to your partner.");
}

function syncListen() {
  const music = state.data.music;
  if (!music?.sessionId) return;
  state.musicSync.joinedSessionId = music.sessionId;
  renderPersistentPlayer();
  updateMusicStatusText();
  if (state.musicSync.loadedSessionId !== music.sessionId) setupSharedAudioController();
  applyRemoteMusicState(true);
  if (music.isPlaying) {
    if (isYouTubeSession(music)) state.musicSync.youtubePlayer?.playVideo?.();
    else $("#sharedAudioPersistent")?.play?.().catch(() => showToast("Tap the player once if your browser still blocks sound."));
  }
  showToast("Live sync joined. The player will stay active while you browse other sections.");
}

async function handleSurpriseSubmit(e) {
  e.preventDefault();
  const uploaded = await uploadFile(selectedFile("#surpriseFile"), "surprises");
  await addDoc(collection(db, "couples", state.coupleId, "surprises"), {
    ownerUid: uid(), title: $("#surpriseTitle").value.trim(), openAt: $("#surpriseOpenAt").value,
    text: $("#surpriseText").value.trim(), fileUrl: uploaded.url || ($("#surpriseUrl")?.value.trim() || ""), fileStoragePath: uploaded.storagePath || "", fileType: uploaded.type || (($("#surpriseUrl")?.value || "").match(/\.(mp4|webm|mov)(\?|$)/i) ? "video/link" : "image/link"), createdAt: serverTimestamp()
  });
  e.target.reset();
  showToast("Surprise prepared.");
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function showIOSInstallInstructions() {
  const message = "On iPhone/iPad, notifications work only from the installed Home Screen app. Open this site in Safari, tap Share, choose Add to Home Screen, open Grow Together from its new icon, then tap Enable Notifications again.";
  showToast(message, 9000);
}

function pushSupportReason() {
  if (!window.isSecureContext) return "Notifications require the HTTPS Hosting link.";
  if (isIOSDevice() && !isStandaloneApp()) return "Install Grow Together on your Home Screen first, then open it from the new icon.";
  if (!("serviceWorker" in navigator)) return "This browser does not support service workers.";
  if (!("PushManager" in window)) return "This browser does not expose the Push API.";
  if (!("Notification" in window)) return "This browser does not support notification permission.";
  return "Push notifications are not supported by this browser or browsing mode.";
}

async function initializePushMessaging({ askPermission = false } = {}) {
  try {
    if (!app || !uid()) return false;
    if (isIOSDevice() && !isStandaloneApp()) {
      if (askPermission) showIOSInstallInstructions();
      return false;
    }
    if (!(await isMessagingSupported()) || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      if (askPermission) showToast(pushSupportReason(), 8000);
      return false;
    }
    if (!firebaseConfig.vapidKey || firebaseConfig.vapidKey.startsWith("PASTE_")) {
      if (askPermission) showToast("Add your Firebase Web Push VAPID key inside firebase-config.js first.");
      return false;
    }
    let permission = Notification.permission;
    if (askPermission && permission !== "granted") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (askPermission) showToast("Push notifications were not allowed.");
      return false;
    }
    messagingServiceWorkerRegistration ||= await navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "./" });
    messaging ||= getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: firebaseConfig.vapidKey,
      serviceWorkerRegistration: messagingServiceWorkerRegistration
    });
    if (!token) {
      if (askPermission) showToast("Firebase did not return a push token. Check the Cloud Messaging setup.");
      return false;
    }
    const deviceId = await hashText(token);
    await setDoc(doc(db, "users", uid(), "devices", deviceId), {
      token,
      coupleId: state.profile?.coupleId || state.coupleId || "",
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
    state.pushToken = token;
    state.pushDeviceId = deviceId;
    if ($("#globalPushBtn")) $("#globalPushBtn").textContent = "Notifications On ✓";
    if ($("#notificationBtn")) $("#notificationBtn").textContent = "Notifications On ✓";
    if (!state.pushReady) {
      onMessage(messaging, payload => {
        const title = payload.notification?.title || payload.data?.title || "Grow Together";
        const body = payload.notification?.body || payload.data?.body || "You have a new update.";
        showToast(`${title}: ${body}`);
        notify(title, body, payload.data || {});
      });
      state.pushReady = true;
    }
    if (askPermission) showToast("Push notifications are enabled on this device.");
    return true;
  } catch (error) {
    console.error("Push setup failed", error);
    if (askPermission) showToast(`Push setup failed: ${error.message}`);
    return false;
  }
}

async function requestNotifications() {
  await initializePushMessaging({ askPermission: true });
}

async function notify(title, body, data = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if (messagingServiceWorkerRegistration) {
      const isRoutine = String(data.tag || "").startsWith("routine-") || String(title).includes("Routine");
      await messagingServiceWorkerRegistration.showNotification(title, {
        body,
        icon: "./icons/heart.svg",
        badge: "./icons/heart.svg",
        tag: data.tag || undefined,
        renotify: true,
        requireInteraction: isRoutine,
        vibrate: isRoutine ? [180, 90, 180, 90, 260] : [120, 60, 120],
        data: { url: data.url || location.href, ...data }
      });
    } else {
      new Notification(title, { body, icon: "./icons/heart.svg" });
    }
  } catch (_) {}
}

async function logoutAndDisablePush() {
  try {
    if (state.pushDeviceId && uid()) await deleteDoc(doc(db, "users", uid(), "devices", state.pushDeviceId));
    if (messaging && state.pushToken) await deleteToken(messaging);
  } catch (error) {
    console.warn("Could not remove push token during logout", error);
  } finally {
    state.pushToken = null;
    state.pushDeviceId = null;
    clearMusicSyncTimers();
    await signOut(auth);
  }
}

function checkEventReminders() {
  maybeAutoCelebrateToday();
  const upcoming = state.data.events.filter(event => [0, 1, 3, 7].includes(Math.round((nextEventOccurrence(event) - new Date(new Date().setHours(12, 0, 0, 0))) / 86400000)));
  upcoming.slice(0, 2).forEach(event => notify("Event Reminder", `${event.title} — ${getEventCounts(event).until}`));
}
setInterval(checkEventReminders, 15 * 60 * 1000);

bindStaticEvents();

if (!firebaseLooksReady) {
  showScreen("#authView");
  showToast("Open firebase-config.js and add Firebase data before running the app.");
} else {
  onAuthStateChanged(auth, async user => {
    cleanupSubscriptions();
    state.user = user;
    state.profile = null;
    state.couple = null;
    state.coupleId = null;
    if (!user) {
      showScreen("#authView");
      return;
    }
    state.profile = await loadProfile(user);
    if ("Notification" in window && Notification.permission === "granted") initializePushMessaging().catch(() => {});
    if (!state.profile.coupleId) {
      showScreen("#pairView");
      return;
    }
    showScreen("#dashboardView");
    startDashboard(state.profile.coupleId);
    initializePushMessaging().catch(() => {});
  });
}
