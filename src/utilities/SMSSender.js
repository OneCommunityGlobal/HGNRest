// smsSender.js
const axios = require('axios');

const twilio = require('twilio');

const client = twilio(process.env.twilio_testAccountSid, process.env.twilio_testAuthToken);

async function twilioSendSMS(bodySMS, fromMob, toMob) {
  // "fromMob": "+15005550006", // Magic "from" number (valid for testing)
  // "toMob": "+15005550006" // Magic "to" number simulates success
  // toMob: '+15005550001', // Magic "to" number simulates invalid number
  // toMob: '+15005550007', // Success
  // toMob: '+15005550008', // Success
  // toMob: '+15005550009', //  Unknown error
  return client.messages.create({
    body: bodySMS,
    from: fromMob, // Magic "from" number (valid for testing)
    to: toMob,
  });
}

async function TextbeltSMS(msg, toMob) {
  console.log(process.env.TextbeltKey);
  return axios.post('https://textbelt.com/text', {
    phone: toMob,
    message: msg,
    key: process.env.TextbeltKey, // Free public API key (1 message/day)
  });
}
async function TelesignSMS(msg, toMob) {
  const TeleSignSDK = require('telesignsdk');

  //  Telesign authentication credentials from the environment variables.
  const customerId = process.env.telesign_CUSTOMER_ID;
  const apiKey = process.env.telesign_API_KEY;

  // Set the default below to your test phone number or pull it from an environment variable.
  // In your production code, update the phone number dynamically for each transaction.
  const phoneNumber = toMob; // process.env.PHONE_NUMBER || "447487575485";

  // Set the message text and type.
  const message = msg;
  const messageType = 'ARN';

  // Instantiate a messaging client object.
  const telesignClient = new TeleSignSDK(customerId, apiKey);

  // Define the callback.
  function smsCallback(error, responseBody) {
    // Display the response body in the console for debugging purposes.
    // In your production code, you would likely remove this.
    if (error === null) {
      console.log(`\nResponse body:\n${JSON.stringify(responseBody)}`);
    } else {
      console.error(`Unable to send SMS. Error:\n\n${error}`);
    }
  }
  console.log(process.env.telesignsendSMS);
  if (process.env.telesignsendSMS !== 'true') return 'Sending SMS Not Enabled';
  // Make the request and capture the response.
  telesignClient.sms.message(smsCallback, phoneNumber, message, messageType);
}

// const { VONAGE_API_KEY } = process.env;
// const { VONAGE_API_SECRET } = process.env;
// const { SMS_SENDER_ID } = process.env;

// const { Vonage } = require('@vonage/server-sdk');

/* const vonage = new Vonage({
  apiKey: VONAGE_API_KEY,
  apiSecret: VONAGE_API_SECRET,
});

function vonSendSMS() {
  vonage.sms
    .send({
      to: process.env.phone,
      from: SMS_SENDER_ID,
      text: 'A text message sent using the Vonage SMS API',
    })
    .then((resp) => {
      console.log('Message sent successfully');
      console.log(resp);
    })
    .catch((err) => {
      console.log('There was an error sending the messages.');
      console.error(err);
    });
}
    */
// module.exports = function (server) {  working fine
// module.exports =

module.exports = { twilioSendSMS, TextbeltSMS, TelesignSMS };
