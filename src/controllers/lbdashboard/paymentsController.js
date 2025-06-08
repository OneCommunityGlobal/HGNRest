const paymentsController = function (Payments) {
  const postPayments = async (req, ordDetails, bidDetails) => {
    try {
      console.log('ordDetails');
      console.log(ordDetails);
      console.log('bidDetails');

      console.log(bidDetails);
      const paypalOrderId = ordDetails.id;
      console.log(paypalOrderId);
      console.log('ordDetails?.purchase_units[0].payments.authorizations');
      console.log(ordDetails?.purchase_units[0].payments.authorizations[0]);

      const authorizationsId = ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.id;
      console.log(authorizationsId);
      const amount = ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.amount.value;
      console.log(amount);
      const expirationTime =
        ordDetails?.purchase_units[0]?.payments?.authorizations[0]?.expiration_time;
      console.log(expirationTime);
      const { expiry, brand } = ordDetails.payment_source.card;
      const lastDigits = ordDetails.payment_source.card.last_digits;

      console.log(lastDigits, expiry, brand, amount);
      const { userId } = bidDetails;
      console.log(bidDetails._id);
      const bidId = bidDetails._id;

      console.log(bidId, userId);

      const status = 'Payment Authorizations Completed';
      //  const newPaymentsData = { ...req.body };

      //   const newPayments = new Payments(newPaymentsData);
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
      console.log('newPayments before save');
      console.log(newPayments);
      const savedPayments = await newPayments.save();
      // console.log(savedPayments);
      return { success: true, data: savedPayments };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

   const postPaymentsWithoutCard = async (req, ordDetails, bidDetails) => {
    try {
      console.log('ordDetails');
      console.log(ordDetails);
      console.log('bidDetails');
      const amount = req.body.biddingHistory.bidPrice;
      console.log(bidDetails);
      const paypalOrderId = ordDetails.id;
      console.log(paypalOrderId);
      const { userId } = bidDetails;
      console.log(bidDetails._id);
      const bidId = bidDetails._id;

      console.log(bidId, userId);

      const {paypalCheckoutNowLink} = ordDetails;
      console.log(paypalCheckoutNowLink)
      
      const status = 'Payment Authorizations Created';
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
      console.log('newPayments before save');
      console.log(newPayments);
      const savedPayments = await newPayments.save();
      // console.log(savedPayments);
      return { success: true, data: savedPayments };
    } catch (error) {
      return { success: false, error: error.message };
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
    
      
      console.log(updatePayments);
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentUpdateOrderWithoutCard error' };
    }
  };

  const postPaymentAuthorizationsWithoutCard = async (ordAuthorizationDetails) => {
    try {
      console.log('ordAuthorizationDetails');
      console.log(ordAuthorizationDetails);
      const paypalOrderId = ordAuthorizationDetails.id;
      console.log(`paypalOrderId is ${paypalOrderId}`);
      
       console.log(ordAuthorizationDetails.purchase_units[0]?.payments); 
      
       const paypalAuthorizationsId = ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.id;
       console.log(`authorizationsId is ${paypalAuthorizationsId}`);

      const paypalCreateTime =        ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.create_time;
      console.log(paypalCreateTime);
      const paypalExpirationTime =        ordAuthorizationDetails?.purchase_units[0]?.payments?.authorizations[0]?.expiration_time;
      console.log(paypalExpirationTime);
      
      // const { expiry, brand } = ordAuthorizationDetails.payment_source.card;
    //  const lastDigits = ordAuthorizationDetails.payment_source.card.last_digits;
// console.log( lastDigits,expiry, brand);
      
      
      
      const status = 'Payment Authorization Completed';
      const matchPayments = await Payments.findOne({paypalOrderId:ordAuthorizationDetails.id});

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
    
      
      console.log(updatePayments);
      return { status: 200, data: updatePayments };
    } catch (error) {
      return { status:500, error: error.response?.data?.error || error.message || 'postPaymentAuthorizationsWithoutCard error' };
    }
  };

  /*  const getPayments = async (req, res) => {
    try {
      console.log('inside getPayment');
      Payments.findOne({ isActive: { $ne: false } })
        .select('-_id')
        .then((results) => {
          console.log('results fetched ');
          res.status(200).send(results);
        })
        .catch((error) => {
          console.log('error');
          res.status(500).send({ error });
        });
    } catch (error) {
      console.log('error occurred');
    }
  };
*/
  return { postPayments,
    postPaymentsWithoutCard,
    postPaymentUpdateOrderWithoutCard,
    postPaymentAuthorizationsWithoutCard
   };
};

module.exports = paymentsController;
