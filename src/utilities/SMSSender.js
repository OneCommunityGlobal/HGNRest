// smsSender.js
const axios = require('axios');

const twilio = require('twilio');

const client = twilio(process.env.twilio_testAccountSid, process.env.twilio_testAuthToken);

async function sendSMS(bodySMS, fromMob, toMob) {
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

module.exports = { sendSMS, TextbeltSMS };
