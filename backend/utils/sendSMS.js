/**
 * backend/utils/sendSMS.js
 * AWS Simple Notification Service (AWS SNS) SMS Gateway
 * Formats Australian/Global mobile numbers and dispatches SMS messages via AWS SNS API.
 */

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

/**
 * Formats mobile phone numbers to E.164 international standard (+61 for Australia)
 * @param {string} phone 10-digit mobile number (e.g. 0414972400 or +61414972400)
 * @returns {string} E.164 formatted number (+61414972400)
 */
function formatE164Phone(phone) {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/\D/g, ''); // strip non-digits
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1); // Convert 0414972400 -> +61414972400
  }
  if (!phone.toString().startsWith('+')) {
    return '+' + cleaned;
  }
  return phone.toString();
}

/**
 * Creates and returns an AWS SNS Client instance if credentials are valid.
 * @returns {SNSClient|null}
 */
function getSNSClient() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

  if (!accessKeyId || !secretAccessKey || accessKeyId.includes('YOUR_') || secretAccessKey.includes('YOUR_')) {
    return null;
  }

  return new SNSClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

/**
 * Dispatch real SMS text message via AWS Simple Notification Service (SNS)
 * @param {string} toPhone Staff mobile number
 * @param {string} messageText Body of SMS message
 * @returns {Promise<{success: boolean, messageId?: string, mode: string, error?: string}>}
 */
async function sendTaskSMS(toPhone, messageText) {
  const formattedTo = formatE164Phone(toPhone);
  const client = getSNSClient();

  // If AWS credentials are not configured, fallback to simulation mode
  if (!client) {
    console.log(`📱 [AWS SNS SIMULATION] To: ${formattedTo} | Message: ${messageText}`);
    return {
      success: true,
      mode: 'SIMULATED',
      message: 'AWS SNS credentials not configured in environment. Notification logged in simulation mode.'
    };
  }

  try {
    const command = new PublishCommand({
      PhoneNumber: formattedTo,
      Message: messageText,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional' // High-priority transactional SMS delivery
        }
      }
    });

    const response = await client.send(command);
    console.log(`✅ [AWS SNS REAL SMS SENT] MessageId: ${response.MessageId} | Sent to: ${formattedTo}`);
    return {
      success: true,
      mode: 'REAL_SMS',
      messageId: response.MessageId
    };
  } catch (error) {
    console.error(`❌ [AWS SNS ERROR] Failed to send SMS to ${formattedTo}:`, error.message);
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
