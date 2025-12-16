import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, update, remove } from "firebase/database";
import dotenv from "dotenv";



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
/**
 * Store meeting data in the NEW consolidated structure
 * Path: healthcare/meetings/{appointmentId}/metadata
 */
export const storeMeetingData = async (meetingId, appointmentId = null) => {
    try {
        if (!appointmentId) {
            console.warn('⚠️ No appointmentId provided, skipping meeting data storage');
            return false;
        }
        // NEW: Use appointmentId as the key, not a random push ID
        const meetingRef = ref(db, `healthcare/meetings/${appointmentId}`);
        const meetingData = {
            metadata: {
                meetingId: meetingId,
                appointmentId: appointmentId,
                createdAt: new Date().toISOString(),
                createdBy: 'server'
            }
        };
        await set(meetingRef, meetingData);
        console.log(`✅ Meeting data stored: ${meetingId} (Appointment: ${appointmentId})`);
        return true;
    } catch (error) {
        console.error('❌ Error storing meeting data:', error);
        return false;
    }
}
/**
 * Store call start information
 * Path: healthcare/meetings/{appointmentId}/call
 */
export const storeCallData = async (appointmentId, callData) => {
    try {
        if (!appointmentId) {
            console.warn('⚠️ No appointmentId provided for call data');
            return false;
        }
        const callRef = ref(db, `healthcare/meetings/${appointmentId}/call`);
        const callInfo = {
            callStartTime: callData.startTime || new Date().toISOString(),
            scheduledEndTime: callData.endTime || null,
            duration: callData.duration || 30,
            status: 'active',
            meetingId: callData.meetingId || null,
            updatedAt: new Date().toISOString()
        };
        await set(callRef, callInfo);
        console.log(`✅ Call data stored for appointment: ${appointmentId}`);
        return true;
    } catch (error) {
        console.error('❌ Error storing call data:', error);
        return false;
    }
}
/**
 * Update call status
 */
export const updateCallStatus = async (appointmentId, status) => {
    try {
        if (!appointmentId) return false;
        const callRef = ref(db, `healthcare/meetings/${appointmentId}/call`);
        await update(callRef, {
            status: status,
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Call status updated to '${status}' for appointment: ${appointmentId}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating call status:', error);
        return false;
    }
}
/**
 * Remove call data (cleanup)
 */
export const removeCallData = async (appointmentId) => {
    try {
        if (!appointmentId) return false;
        const callRef = ref(db, `healthcare/meetings/${appointmentId}/call`);
        await remove(callRef);
        console.log(`✅ Call data removed for appointment: ${appointmentId}`);
        return true;
    } catch (error) {
        console.error('❌ Error removing call data:', error);
        return false;
    }
}