/* eslint-disable camelcase */
const axios = require('axios');

const Payments = require('../../models/lbdashboard/payments');

const paymentController = require('./paymentsController');

const paymentControllerInstance = paymentController(Payments);

const { postPaymentStatusWithoutCard } = paymentControllerInstance;


const Bids = require('../../models/lbdashboard/bids');

const bidsController = require('./bidsController');

const bidsControllerInstance = bidsController(Bids);

const { getPayPalAccessTokenl } = bidsControllerInstance;

const webHookController = function (Bids) {
  // const webHookController = function () {
  const myHook = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();

    try {
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
      return res.status(200).json({success:true, data: webhookResponse.data});
    } catch (error) {return res.status(500).json({success:false, error: serror.response?.data?.error || error.message || 'Unknown error in myHook'});
    }
  };

  
  function emitBid(bidPric) {
    const { getIO } = require('../../sockets/BiddingService/connServer');
    const io = getIO();
  
    if (io) {
      io.emit('bid-updated', `current bid price is ${bidPric}`);
    }
    // Notify all connected clients
  }
  const webhookTest = async (req, res) => {
    console.log('webhookTest.req.body below');
    console.log(req.body);
    console.log('req.body above');

    try {
      const { event_type } = req.body;
      console.log(event_type);
      switch (event_type){
        case 'PAYMENT.AUTHORIZATION.CREATED' : console.log('Payment Authorization created');
                                              
                                               break;
        case 'PAYMENT.AUTHORIZATION.VOIDED' : 
         console.log('Payment Authorization Voided');
                                               break;
        case 'CHECKOUT.ORDER.COMPLETED': 
        console.log(' CHECKOUT.ORDER.COMPLETED', req.body);
        break;

        case  'CHECKOUT.ORDER.APPROVED' :{
        const paymentStatusWithoutCardC = await postPaymentStatusWithoutCard('CHECKOUT.ORDER.APPROVED','O',req.body?.resource.id);
       if (paymentStatusWithoutCardC.status !== 200)
       {
          if (res.headersSent) return;
        return res.status(500).json({ success: false, error: paymentStatusWithoutCardC?.error });
       }
       
       return res.status(200).json({success:true, data:paymentStatusWithoutCardC.data});
       
       
        }
        case 'PAYMENT.CAPTURE.COMPLETED':{
        const paymentStatusWithoutCardC = await postPaymentStatusWithoutCard('PAYMENT.CAPTURE.COMPLETED','A',req.body?.resource?.supplementary_data?.related_ids?.authorization_id);
       if (paymentStatusWithoutCardC.status !== 200)
       {
          if (res.headersSent) return;
        return res.status(500).json({ success: false, error: paymentStatusWithoutCardC?.error });
       }
       
       return res.status(200).json({success:true, data:paymentStatusWithoutCardC.data});
        }
        default: console.log("default webhook type");

      }
      return res.status(200).json({success:true, data:'event received'});
    } catch (error) {
      console.log(error);
      return res.status(500).json({success:false,error: error.response?.data?.error || error.message || 'error in webhook'});
    }
     
  };

  return {
    myHook,
    webhookTest,
  };
};
module.exports = webHookController;
