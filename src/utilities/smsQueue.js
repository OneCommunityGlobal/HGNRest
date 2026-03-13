const { twilioSendSMS, TextbeltSMS, TelesignSMS } = require('./SMSSender');

const queue = [];
let processing = false;

const getProvider = () => (process.env.SMS_PROVIDER || 'telesign').toLowerCase();

const sendSmsViaProvider = async (message, to) => {
  const provider = getProvider();
  if (!to) {
    throw new Error('SMS recipient is required.');
  }

  switch (provider) {
    case 'twilio': {
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!from) {
        throw new Error('TWILIO_FROM_NUMBER is not configured.');
      }
      return twilioSendSMS(message, from, to);
    }
    case 'textbelt':
      return TextbeltSMS(message, to);
    case 'telesign':
    default:
      return TelesignSMS(message, to);
  }
};

const processQueue = async () => {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    try {
      const response = await Promise.resolve(sendSmsViaProvider(item.message, item.to));
      if (process.env.SMS_LOG_RESPONSES === 'true') {
        console.log('SMS send response:', response?.data || response);
      }
    } catch (error) {
      console.error('Failed to send SMS:', error?.response?.data || error.message);
    }
  }

  processing = false;
};

const queueSmsNotification = ({ to, message }) => {
  if (!to || !message) return;
  queue.push({ to, message });
  setImmediate(() => {
    processQueue().catch((error) => console.error('SMS queue error:', error.message));
  });
};

module.exports = { queueSmsNotification };
