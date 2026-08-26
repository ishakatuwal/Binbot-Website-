/**
 * backend/utils/sendSMS.js
 * ClickSend Australian SMS Gateway Service
 * Dispatches real domestic Australian SMS text messages via ClickSend v3 REST API.
 */

const https = require('https');

/**
 * Formats mobile phone numbers to E.164 international standard (+61 for Australia)
 * @param {string} phone 10-digit mobile number (e.g. 0404541746 or +61404541746)
 * @returns {string} E.164 formatted number (+61404541746)
 */
function formatE164Phone(phone) {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/\D/g, ''); // strip non-digits
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1); // Convert 0404541746 -> +61404541746
  }
  if (!phone.toString().startsWith('+')) {
    return '+' + cleaned;
  }
  return phone.toString();
}

/**
 * Dispatch real SMS text message via ClickSend Australian Gateway
 * @param {string} toPhone Staff mobile number
 * @param {string} messageText Body of SMS message
 * @returns {Promise<{success: boolean, messageId?: string, mode: string, error?: string}>}
 */
async function sendTaskSMS(toPhone, messageText) {
  const username = (process.env.CLICKSEND_USERNAME || '').trim();
  const apiKey = (process.env.CLICKSEND_API_KEY || '').trim();
  const formattedTo = formatE164Phone(toPhone);

  // If ClickSend credentials are not configured, fallback to simulation mode
  if (!username || !apiKey || username.includes('YOUR_') || apiKey.includes('YOUR_')) {
    console.log(`📱 [CLICKSEND SIMULATION] To: ${formattedTo} | Message: ${messageText}`);
    return {
      success: true,
      mode: 'SIMULATED',
      message: 'ClickSend credentials not configured in environment. Notification logged in simulation mode.'
    };
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      messages: [
        {
          source: 'binbot-node',
          body: messageText,
          to: formattedTo
        }
      ]
    });

    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64');

    const options = {
      hostname: 'rest.clicksend.com',
      port: 443,
      path: '/v3/sms/send',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.response_code === 'SUCCESS' && json.data && json.data.messages && json.data.messages.length > 0) {
            const msgInfo = json.data.messages[0];
            console.log(`✅ [CLICKSEND REAL SMS SENT] Message ID: ${msgInfo.message_id} | Carrier: ${msgInfo.carrier || 'AU'} | Sent to: ${formattedTo}`);
            resolve({
              success: true,
              mode: 'REAL_SMS',
              messageId: msgInfo.message_id,
              carrier: msgInfo.carrier
            });
          } else {
            console.warn(`⚠️ [CLICKSEND API WARNING] Response:`, json.response_msg || body);
            resolve({
              success: false,
              mode: 'FAILED',
              error: json.response_msg || 'ClickSend API returned non-success response'
            });
          }
        } catch (parseErr) {
          console.error(`❌ [CLICKSEND PARSE ERROR]`, parseErr.message);
          resolve({
            success: false,
            mode: 'FAILED',
            error: parseErr.message
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ [CLICKSEND NETWORK ERROR] Failed to send SMS to ${formattedTo}:`, err.message);
      resolve({
        success: false,
        mode: 'FAILED',
        error: err.message
      });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendTaskSMS,
  formatE164Phone
};
