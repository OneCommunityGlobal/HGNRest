// smsController.js
const { SMSSender, TextbeltSMS: TextbeltSender } = require('../../utilities/SMSSender');

async function sendSMS(req, res) {
  const { msg, fromMob, toMob } = req.body;
  try {
    const result = await SMSSender(msg, fromMob, toMob);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error Sending SMS' });
  }
}

async function TextbeltSMS(req, res) {
  const { msg } = req.body;

  const { toMob } = req.body;
  try {
    const response = await TextbeltSender(msg, toMob);
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Sending SMS Failed' });
  }
}

async function TelesignSMS(req, res) {
  const { msg } = req.body;

  const { toMob } = req.body;
  try {
    const response = await TelesignSMS(msg, toMob);
    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Sending SMS Failed' });
  }
}

module.exports = {
  sendSMS,
  TextbeltSMS,
  TelesignSMS,
};
