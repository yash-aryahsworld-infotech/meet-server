import crypto from 'crypto';

// Secret key for encryption - should be in .env in production
const SECRET_KEY = process.env.MEETING_SECRET_KEY || 'healthcare-plus-secret-key-2024';

/**
 * Generate a secure meeting ID from appointment ID
 * Uses HMAC-SHA256 to create a one-way hash that can't be reversed
 * @param {string} appointmentId - The appointment ID
 * @returns {string} - Secure meeting ID (12 characters)
 */
export const generateMeetingId = (appointmentId) => {
  // Create HMAC hash using appointment ID
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(appointmentId.toString());
  const hash = hmac.digest('hex');
  
  // Take first 12 characters and convert to uppercase for readability
  const meetingId = hash.substring(0, 12).toUpperCase();
  
  return meetingId;
}

/**
 * Verify if a meeting ID matches an appointment ID
 * @param {string} meetingId - The meeting ID to verify
 * @param {string} appointmentId - The appointment ID to check against
 * @returns {boolean} - True if they match
 */
export const verifyMeetingId = (meetingId, appointmentId) => {
  const expectedMeetingId = generateMeetingId(appointmentId);
  return meetingId.toUpperCase() === expectedMeetingId.toUpperCase();
}

/**
 * Generate a completely random meeting ID (for meetings without appointment)
 * @returns {string} - Random meeting ID (12 characters)
 */
export const generateRandomMeetingId = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}


