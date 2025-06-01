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
    postPaymentsWithoutCard
   };
};

module.exports = paymentsController;
