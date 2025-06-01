/* eslint-disable camelcase */
const axios = require('axios');

const Payments = require('../../models/lbdashboard/payments');

const Bids = require('../../models/lbdashboard/bids');

const bidsController = require('./bidsController');

const bidsControllerInstance = bidsController(Bids);

const { getPayPalAccessTokenl } = bidsControllerInstance;
console.log("inside webhookcontroller.js ")
console.log("typeof bidsController"); 
console.log(typeof bidsController);

console.log("typeof bidsControllerInstance"); 
console.log(typeof bidsControllerInstance);
console.log("inside webhookcontroller.js ")

const webHookController = function (Bids) {
  // const webHookController = function () {
  const myHook = async (req, res) => {
    console.log('getMyHook');
    console.log(process.env.BASE_URL);
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);

    try {
      console.log('before webhookResponse');
      const webhookResponse = await axios.post(
        `${process.env.BASE_URL}/v1/notifications/webhooks`,
        {
          // url: 'https://example.com/all_webhook',
          // url: 'https://localhost.com/myWebhooks',
          // url: 'https://localhost.com/api/lb/myWebhooks',
          url: 'https://empty-aware-pole-showcase.trycloudflare.com/api/lb/myWebhooks',

          event_types: [
            /*  { name: 'PAYMENT.AUTHORIZATION.CREATED' }, */
            { name: 'PAYMENT.AUTHORIZATION.VOIDED' },
            { name: '*' },
          ],
        },

        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(webhookResponse);
      // return { status: 200, data: 'accessToken' };
      return res.status(200).send(webhookResponse.data);
    } catch (error) {
      console.log(error.response.data);
      return res.status(500).send('Failure');
    }
  };

  /*
const verifyPaypalSignature = require('./verifyPaypalSignature');

app.post("/api/lb/myWebhooks", express.json(), verifyPaypalSignature, 
(req, res) => {
  // Your logic
  res.sendStatus(200);
});

{{base_url}}/v1/notifications/verify-webhook-signature

  */
  // const socketIo = require('socket.io');
  // const io = socketIo(connServer);

  function emitBid(bidPric) {
    const { getIO } = require('../../sockets/BiddingService/connServer');
    console.log('Getting socket IO instance...');
    const io = getIO();
    console.log('IO Initialized');

    if (io) {
      io.emit('bid-updated', `current bid price is ${bidPric}`);
    }
    console.log('io.emitted');
    // Notify all connected clients
  }
  const webhookTest = async (req, res) => {
    console.log('Message Received');
    console.log('req.body below');
    /* purchase_units: [
            {
              items: [
                {
                  name: 'T-Shirt',
                  unit_amount: {
                    currency_code: 'USD',
                    value: bidPrice,
          */

    console.log(req.body?.resource?.amount?.value);
    console.log(req.body);

    console.log('req.body above');

    try {
      const { event_type } = req.body;
      // const bidPrice = req.body.resource.amount.value;
      const bidPrice = req.body.reference;

      if (event_type === 'PAYMENT.AUTHORIZATION.CREATED') {
        console.log('PAYMENT.AUTHORIZATION.CREATED');
        // emitBid(bidPrice);
      } else if (event_type === 'PAYMENT.AUTHORIZATION.VOIDED') {
        console.log(' Payment Authorization Voided:', req.body);

        // Handle payment void scenario
      } else if (event_type === 'CHECKOUT.ORDER.COMPLETED') {
        console.log(' CHECKOUT.ORDER.COMPLETED', req.body);

        // Handle payment void scenario
      }

      // Respond to PayPal to confirm receipt
      return res.status(200).json('event received');
    } catch (error) {
      console.log(error);
      return res.status(501).json('error in webhook');
    }
  };

  return {
    myHook,
    webhookTest,
  };
};
module.exports = webHookController;
