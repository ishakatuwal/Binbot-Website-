/**
 * backend/utils/sendSMS.js
 * Twilio SMS Gateway Messaging Service
 * Formats Australian/Global mobile numbers and dispatches real SMS messages via Twilio REST API.
 */

const twilio = require('twilio');

/**
 * Formats mobile phone numbers to E.164 international standard (+61 for Australia)
 * @param {string} phone 10-digit mobile number (e.g. 0414972400 or +61414972400)
 * @returns {string} E.164 formatted number (+61414972400)
 */
function formatE164Phone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); // strip non-digits
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1); // Convert 0414972400 -> +61414972400
  }
  if (!phone.startsWith('+')) {
    return '+' + cleaned;
  }
  return phone;
}

/**
 * Dispatch real SMS text message via Twilio API
 * @param {string} toPhone Staff mobile number
 * @param {string} messageText Body of SMS message
 * @returns {Promise<{success: boolean, sid?: string, mode: string, error?: string}>}
 */
async function sendTaskSMS(toPhone, messageText) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  const formattedTo = formatE164Phone(toPhone);

  // Check if Twilio API credentials are present in environment variables
  if (!accountSid || !authToken || !fromPhone || accountSid.includes('YOUR_') || authToken.includes('YOUR_')) {
    console.log(`📱 [TWILIO SMS SIMULATION] To: ${formattedTo} | Message: ${messageText}`);
    return {
      success: true,
      mode: 'SIMULATED',
      message: 'Twilio credentials not configured in .env. Message logged to server console.'
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body: messageText,
      from: fromPhone,
      to: formattedTo
    });

    console.log(`✅ [TWILIO REAL SMS SENT] SID: ${result.sid} | Sent to: ${formattedTo}`);
    return {
      success: true,
      mode: 'REAL_SMS',
      sid: result.sid
    };
  } catch (error) {
    console.error(`❌ [TWILIO SMS ERROR] Failed to send SMS to ${formattedTo}:`, error.message);
    return {
      success: false,
      mode: 'FAILED',
      error: error.message
    };
  }
}

module.exports = {
  sendTaskSMS,
  formatE164Phone
};
