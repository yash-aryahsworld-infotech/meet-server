const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, push } = require("firebase/database");
const dotenv = require("dotenv");

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("🔥 Firebase Client (Realtime DB) Connected");

// Function to store meeting data in healthcare table
async function storeMeetingData(meetingId, appointmentId = null) {
  try {
    const meetingRef = ref(db, 'healthcare/meetings');
    const newMeetingRef = push(meetingRef);
    
    const meetingData = {
      meetingId: meetingId,
      appointmentId: appointmentId,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      time: new Date().toLocaleTimeString('en-US', { hour12: false }), // HH:MM:SS
      timestamp: Date.now()
    };
    
    await set(newMeetingRef, meetingData);
    console.log(`✅ Meeting data stored: ${meetingId}${appointmentId ? ` (Appointment: ${appointmentId})` : ''}`);
    return true;
  } catch (error) {
    console.error('❌ Error storing meeting data:', error);
    return false;
  }
}

module.exports = { app, db, storeMeetingData };
