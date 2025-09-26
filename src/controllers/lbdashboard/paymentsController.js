const Users = require('../../models/lbdashboard/users');

const paymentsController = function (Payments) {
  const postPayments = async (req, ordDetails, bidDetails) => {
    try {
      const paypalOrderId = ordDetails.id;
      
      const authorizationsId = ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.id;
      const amount = ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.amount.value;
      const expirationTime =
        ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.expiration_time;
      const { expiry, brand } = ordDetails.payment_source.card;
      const lastDigits = ordDetails.payment_source.card.last_digits;

      const { userId } = bidDetails;
      const bidId = bidDetails._id;

      
      const status = 'Payment Authorizations Completed';
      const newPayments = new Payments({
        paypalOrderId,
        authorizationsId,
        payment_source: {
          card: {
            lastDigits,
            expiry,
            brand,
          },
        },
        purchase_units: {
          payments: {
            amount,
            expirationTime,
          },
        },
        userId,
        bidId,
        status,
      });
      const savedPayments = await newPayments.save();
      return { success: true, data: savedPayments };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

   const postPaymentsWithoutCard = async (req, ordDetails, bidDetails) => {
    try {
      const amount = req.body.biddingHistory.bidPrice;
      const paypalOrderId = ordDetails.id;
      const { userId } = bidDetails;
      const bidId = bidDetails._id;

      
      const {paypalCheckoutNowLink} = ordDetails;
      
      const status = 'Payment.Order.Created';
      const newPayments = new Payments({
        paypalOrderId,
        paypalCheckoutNowLink,
        purchase_units: {
          payments: {
            amount,
          },
        }, 
        userId,
        bidId,
        status,
      });
      const savedPayments = await newPayments.save();
      return { status: 200, data: savedPayments };
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error in postPaymentsWithoutCard' };
    }
  };

  const postPaymentUpdateOrderWithoutCard = async (ordAuthorizationDetails) => {
    try {
      console.log('ordAuthorizationDetails');
      console.log(ordAuthorizationDetails);
      const paypalOrderId = ordAuthorizationDetails.id;
      console.log(`paypalOrderId is ${paypalOrderId}`);
      console.log(ordAuthorizationDetails.purchase_units[0].amount);
      console.log(ordAuthorizationDetails.purchase_units[0].amount.value);
      
      
      const amount = ordAuthorizationDetails?.purchase_units[0]?.amount?.value;
      console.log(amount);
      const createTime =
        ordAuthorizationDetails?.create_time;
      console.log(createTime);
      
      
      const status = 'Payment Updated';
    const updateData = { 
        purchase_units: {
          payments: {
            amount
          },
        },
        status};
     

      const updatePayments = await Payments.findOneAndUpdate({
        paypalOrderId:ordAuthorizationDetails.id },
updateData, {new:true}
         );
if (!updatePayments) {
      return { status: 400, error: 'Invalid Payment details' };
    }
    
      
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentUpdateOrderWithoutCard error' };
    }
  };

  const postPaymentAuthorizationsWithoutCard = async (ordAuthorizationDetails) => {
    try {
      const paypalOrderId = ordAuthorizationDetails.id;
      
       const paypalAuthorizationsId = ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.id;
      
      const paypalCreateTime =        ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.create_time;
      const paypalExpirationTime =        ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.expiration_time;
      
      
      
      const status = 'Payment.Authorization.Created';
      const matchPayments = await Payments.findOne({paypalOrderId});

    if (!matchPayments) {
      return { status: 400, error: 'Invalid Payment details' };
    }
  const updateData = { 
        paypalAuthorizationsId,
        paypalCreateTime,
        paypalExpirationTime,
        status};
     

      const updatePayments = await Payments.findOneAndUpdate({
        paypalOrderId:ordAuthorizationDetails.id },
updateData, {new:true}
         );
if (!updatePayments) {
      return { status: 400, error: 'Invalid Payment details' };
    }
    
      
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentAuthorizationsWithoutCard error' };
    }
  };

  const postPaymentCheckoutNowWithoutCard = async (req) => {
    try {
      const paypalOrderId = req?.paypalOrderId ?? req?.body?.paypalOrderId;

      
       
      
      const status = 'Buyer Approval Request';
      const matchPayments = await Payments.findOne({paypalOrderId});

    if (!matchPayments) {
      return { status: 400, error: 'Invalid Order Paument details' };
    }
  const updateData = { 
        status};
     

      const updatePayments = await Payments.findOneAndUpdate({
        paypalOrderId },
updateData, {new:true}
         );
if (!updatePayments) {
      return { status: 400, error: 'Invalid Order Payment details' };
    }
    
      
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentAuthorizationsWithoutCard error' };
    }
  };

  const postPaymentStatusWithoutCard = async (inStatus, inType, inReq) => {
    try {
      
      const matchPayments = inType === 'O'?   await Payments.findOne({paypalOrderId:inReq}):
       await Payments.findOne({paypalAuthorizationsId:inReq});

 
      
      
      
      
    if (!matchPayments) {
      return { status: 400, error: 'Invalid Payment details' };
    }
  const updateData = { 
        status:inStatus};

const updatePayments = inType === 'O'?   await Payments.findOneAndUpdate({paypalOrderId:inReq},
updateData, {new:true}):
       await Payments.findOneAndUpdate({paypalAuthorizationsId:inReq},
updateData, {new:true});

if (!updatePayments) {
      return { status: 400, error: 'Invalid Payment details' };
    }
    
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentAuthorizationsWithoutCard error' };
    }
  };

    const getPayments = async (req, res) => {
      const userExists = await Users.findOne({ email: req.body.email });
            if (!userExists) {
              return res.status(500).json({ success: false, error: 'Invalid email' });
            }
      
    try {
      Payments.findOne({ isActive: { $ne: false },userId:userExists._id })
        .select('-_id')
        .then((results) => res.status(200).json({success:true, data: results}))
        .catch((error) => {
          console.log('error');
          return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 'Unknown error in getPayments' });
        });
    } catch (error) {
      console.log('error occurred');
      return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 'Unknown error in getPayments' });
      
    }
  };

  return { postPayments,
    postPaymentsWithoutCard,
    postPaymentUpdateOrderWithoutCard,
    postPaymentAuthorizationsWithoutCard,
    postPaymentCheckoutNowWithoutCard,
    postPaymentStatusWithoutCard,
    getPayments
   };
};

module.exports = paymentsController;
