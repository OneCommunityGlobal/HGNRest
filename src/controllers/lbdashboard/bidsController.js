console.log('[bc.js] loaded');
let ready = false;

const axios = require('axios');
const Payments = require('../../models/lbdashboard/payments');
const Users = require('../../models/lbdashboard/users');
const Listings = require('../../models/lbdashboard/listings');
const BidDeadlines = require('../../models/lbdashboard/bidDeadline');
const paymentController = require('./paymentsController');

const paymentControllerInstance = paymentController(Payments);
const { addBidToHistory } = require('./bidDeadlinesController')();

const { postPayments, postPaymentsWithoutCard } = paymentControllerInstance;
const { getIO } = require('../../sockets/BiddingService/connServer');
const emailSender = require('../../utilities/emailSender');

const parseDate = (dateStr) => {
    const [month, day, year] = dateStr.split('/'); // Extract parts
    return new Date(`${month}-${day}-${year}`); // Convert to YYYY-MM-DD format
  };


  async function getRentalPeriod(startDate, endDate) {
   console.log(startDate);
   console.log(endDate)
    const inStartDate = startDate.toString().includes('/') ? parseDate(startDate) :startDate;
     const inEndDate = endDate.toString().includes('/') ?parseDate(endDate):endDate

    const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);

    console.log(`rentalPeriod in days: ${rentalPeriod}`);
    return rentalPeriod;
  }

const bidsController = function (Bids) {
  // validations
  // 1. listingId not null done
  // 2. userId not null  ensures email & name not null
  // ? requestorId req.body.requestorId from middleTier
  // done
  // 3. termsAgreed Not null done
  // 4. startDate not null  done
  // 5. endDate not null  done
  // 6. startDate > todays date done
  // 7. endDate > startDate  done
  // 8. price > 0  done
  // 9. price = periodOfRenting * listingPrice not done
  //  Generate PayPal Access Token

  
  const postBidsloc = async (req, ordDetails) => {
    console.log("inside postBidsloc")
    try {
      const { listingId, requestor, termsAgreed, email } = req.body;
      const { bidPrice } = req.body.biddingHistory;
      console.log(ordDetails);
      const paypalOrderId = ordDetails.id;
      console.log(paypalOrderId);

      const reqdURL = ordDetails.links;
      
      console.log(reqdURL);
      
      const checkoutnowLink = reqdURL.find((u) => u.href.includes('checkoutnow'));
      
      console.log('checkoutnowLink');
      console.log(checkoutnowLink?.href);
      

      const inStartDate = parseDate(req.body.startDate);
      const inEndDate = parseDate(req.body.endDate);

      console.log(req.body.requestor);
      console.log(req.body);

      const userExists = await Users.findOne({ email });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }
      console.log(userExists);

      if (!listingId) {
        return { status: 400, error: 'listingId cannot be empty' };
      }

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return { status: 400, error: 'Invalid listingId' };
      }
      console.log(listingsExists);

      // if (!requestor?.requestorId || !userExists._id) {
      if (!userExists._id) {
        return { status: 400, error: 'userId cannot be empty' };
      }
      if (!termsAgreed) {
        return { status: 400, error: 'termsAgreed cannot be empty' };
      }
      if (!inStartDate) {
        return { status: 400, error: 'startDate cannot be empty' };
      }
      if (!inEndDate) {
        return { status: 400, error: 'endDate cannot be empty' };
      }
      if (inEndDate <= inStartDate) {
        return { status: 400, error: 'endDate should be greater than the startDate' };
      }
      if (!bidPrice) {
        return { status: 400, error: 'Bid price should be greater than 0' };
      }

      // const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);
      const rentalPeriod = await getRentalPeriod(req.body.startDate, req.body.endDate)
      console.log(`rentalPeriod in days: ${rentalPeriod}`);
      console.log(rentalPeriod * bidPrice);
      const newBidsData = { ...req.body, userId: userExists._id, paypalOrderId, paypalCheckoutNowLink:checkoutnowLink?.href };
      const newBids = new Bids(newBidsData);
      console.log(newBids);
      const savedBids = await newBids.save();
      // Notify all connected clients
      // send in-app notification
      console.log('Getting socket IO instance...');
      const io = getIO();
      console.log('io is', io);
      if (io) {
        io.emit('bid-updated', `current bid price is ${bidPrice}`);
      }

      const savedBidHistory = await addBidToHistory(BidDeadlines, listingId, bidPrice);
      console.log(savedBidHistory);

      // console.log(savedBids);
      return { status: 200, data: savedBids };
    } catch (error) {
      return { status: 500, error: error.message };
    }
  };

  const postBids = async (req, res) => {
    try {
      const savedBids = await postBidsloc(req);
      if (savedBids !== 200) res.status(500).json({ success: false, error: error.message });
      // console.log(savedBids);
      res.status(200).json({ success: true, data: savedBids });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  const getBids = async (req, res) => {
    console.log('getBids');
    try {
      console.log('inside getBids');
      Bids.findOne({ isActive: { $ne: false } })
        .select('userId listingId startDate bidPrice -_id')
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
  const valid = require('card-validator');

  async function getPayPalAccessTokenl() {
    console.log('getPayPalAccessToken');
    try {
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString('base64');

      const response = await axios.post(
        `${process.env.BASE_URL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return response.data.access_token;

      // return res.status(200).json(response.data.access_token);
    } catch (error) {
      console.error('get PayPalAccessToken Error:', error.response?.data || error.message);
    }
  }
  const getPayPalAccessToken = async (req, res) => {
    try {
      const payPalAccessToken = await getPayPalAccessTokenl();
      return res.status(200).json(payPalAccessToken);
    } catch (error) {
      return res
        .status(400)
        .json({ 'get PayPalAccessToken Error': error.response?.data || error.message });
    }
  };

  const getSetupCardToken = async (req, res) => {
    console.log('getSetupCardToken');
    console.log(req.query.includeCardholderName);
    const { includeCardholderName } = req.query;
    console.log(includeCardholderName);
    console.log(req.body.requestor);

    // console.log(name);
    const { cardNumber, expiry, cvv, amt } = req.body.card;
    console.log(cardNumber, expiry, cvv, amt);
    console.log('before calling getPayPal');

    console.log('before cardNumber validation');
    const cardNumberValidation = valid.number(cardNumber);
    console.log(cardNumberValidation);

    if (cardNumberValidation.card) {
      console.log(cardNumberValidation.card.type); // 'visa'
    }
    if (!cardNumberValidation.isValid) {
      return res.status(401).json({ error: 'Invalid CardNumber' });
    }

    console.log('before expiry date validation');

    if (!expiry || typeof expiry !== 'string') {
      return res.status(401).json({ error: 'Expiry Date is required and must be a string' });
    }

    // Validate format mm/dd/YYYY
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dateRegex.test(expiry)) {
      return res
        .status(400)
        .json({ error: 'Invalid expiry format. Use MM/DD/YYYY (e.g., 01/31/2025)' });
    }

    console.log('before valid.expirationDate');
    const [expmm, , expyy] = expiry.split('/');
    console.log(`${expmm} - ${expyy}`);
    const expDate = `${expmm}/${expyy}`; // validate api expected format mm/yyyy
    console.log(expDate);
    const expDateValidation = valid.expirationDate(expDate);

    console.log(expDateValidation);

    if (!expDateValidation.isValid) {
      return res.status(401).json({ error: 'Invalid expiration date' });
    }
    const { name } = req.query.includeCardholderName === 'Y' && req.body;
    console.log(includeCardholderName);
    if (includeCardholderName === 'Y') {
      console.log('includeCardholderName');

      console.log(includeCardholderName);

      console.log('before cardName validation');
      console.log(name);
      const cardholderNameValidation = valid.cardholderName(name);
      console.log(cardholderNameValidation);

      if (!cardholderNameValidation.isValid) {
        return res.status(401).json({ error: 'Invalid cardholder name' });
      }
    }
    console.log('before cvv validation');

    const cvvValidation = valid.cvv(cvv);
    console.log(cvvValidation);
    if (!cvvValidation.isValid) {
      return res.status(401).json({ error: 'Invalid cvv' });
    }

    console.log('before getPayPalAccessToken');
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log(expDate);

    const paymentCardToken = {
      // intent: 'sale',
      payment_source: {
        card: {
          number: cardNumber,
          expiry: `${expyy}-${expmm}`, // yyyy-mm API expected format
          security_code: cvv,
          name: includeCardholderName === 'Y' ? name : null,
        },
      },
    };
    console.log(paymentCardToken);

    try {
      // Call PayPal API to process payment tokens
      const setupTokenResponse = await axios.post(
        `${process.env.BASE_URL}/v3/vault/setup-tokens`,
        paymentCardToken,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      // return res.json({ success: true, data: response.data });
      return setupTokenResponse.data;
    } catch (error) {
      console.error(
        'PayPal Payment Token Error:',
        error.response?.data?.details?.description || error.message,
      );
      // res
      //  .status(500)
      //  .json({ success: false, error:
      return error.response?.data;
    }
  };
  const getPaymentCardToken = async (req, res) => {
    console.log('getPermanentPaymentCardToken');

    console.log('before getPayPalAccessToken');
    const accessToken = await getPayPalAccessTokenl();
    const setupToken = await getSetupCardToken(req);

    try {
      const paymentCardToken = {
        payment_source: {
          token: {
            id: `${setupToken.id}`,
            type: 'SETUP_TOKEN',
          },
        },
      };
      console.log(paymentCardToken);

      // Call PayPal API to process payment tokens
      const paymentTokensResponse = await axios.post(
        `${process.env.BASE_URL}/v3/vault/payment-tokens`,
        paymentCardToken,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return res.json({ success: true, data: paymentTokensResponse.data });
    } catch (error) {
      console.error(
        'PayPal Payment Token Error:',
        error.response?.data?.details?.description || error.message,
      );
      res
        .status(500)
        .json({ success: false, error: error.response?.data?.details[0]?.description });
    }
  };

  
  // const checkoutOrderWithCard = async (req, res) => {

  async function createOrderl(req) {
    console.log("createOrderWithCardl")
    console.log(req.body);

    const accessToken = await getPayPalAccessTokenl();

    console.log(accessToken);
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { cardNumber, expiry, cvv } = req.body;
    const { bidPrice } = req.body.biddingHistory;
   // const { listingId } = req.body;
    console.log(req.body);
    const payerEmailAddress = req.body.email;
    console.log('payerEmailAddress');
    console.log(payerEmailAddress);
    console.log(cardNumber, expiry, cvv, bidPrice);
    const [expmm, , expyy] = expiry.split('/');
    console.log(`${expmm} - ${expyy}`);

    const inStartDate = parseDate(req.body.startDate);
    const inEndDate = parseDate(req.body.endDate);

    const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);

    console.log(`rentalPeriod in days: ${rentalPeriod}`);
    console.log(rentalPeriod * bidPrice);

    try {
      const checkoutOrder = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', // 'CAPTURE'

          purchase_units: [
            {
              reference_id: bidPrice, //listingId,
              amount: {
                currency_code: 'USD',
                value: rentalPeriod * bidPrice,
                breakdown: {
                  item_total: {
                    currency_code: 'USD',
                    value: rentalPeriod * bidPrice,
                  },
                },
              },
              items: [
                {
                  name: 'Rent',
                  unit_amount: {
                    currency_code: 'USD',
                    value: bidPrice,
                  },
                  quantity: rentalPeriod,

                  tax: {
                    currency_code: 'USD',
                    value: '0.00',
                  },
                },
              ],
            },
          ],
          payment_source: {
            // pass the card details directly

            card: {
              number: cardNumber,
              expiry: `${expyy}-${expmm}`, // yyyy-mm API expected format
              security_code: cvv,
            },
          },
          payer: {
            email_address: payerEmailAddress,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': paypalRequestId,
          },
        },
      );
      console.log(checkoutOrder.data);
      return { success: true, data: checkoutOrder.data };
    } catch (error) {
      console.log('error');
      console.log(error);
      return { success: false, error: error.response?.data };
    }
  }

  const createOrder = async (req, res) => {
    try {
      const creatOrderC = await createOrderl(req);
      console.log('after local call');
      console.log(creatOrderC);

      console.log(creatOrderC.success === true);
      if (creatOrderC?.success) {
        return res.status(201).json({ success: true, data: creatOrderC });
      }

      return res.status(500).json({ success: false, error: creatOrderC.error });
    } catch (error) {
      console.log('error');
      console.log(error.response);

      return res.status(500).json({ success: false, error: error.response });
    }
  };

  async function createOrderWithoutCardl(req) {
    const accessToken = await getPayPalAccessTokenl();
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { bidPrice } = req.body.biddingHistory;
    
    const inStartDate = req.body.startDate;
    const inEndDate = req.body.endDate;

      

     if (!inStartDate) {
        return { status: 400, error: 'startDate cannot be empty' };
      }
      if (!inEndDate) {
        return { status: 400, error: 'endDate cannot be empty' };
      }
      if (inEndDate <= inStartDate) {
        return { status: 400, error: 'endDate should be greater than the startDate' };
      }
      if (!bidPrice) {
        return { status: 400, error: 'Bid price should be greater than 0' };
      }

    const rentPeriod = await getRentalPeriod(inStartDate, inEndDate);
    console.log(rentPeriod)

    try {
      const checkoutOrder = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', // 'CAPTURE'

          purchase_units: [
            {
              reference_id: bidPrice,
              amount: {
                currency_code: 'USD',
                value: bidPrice * rentPeriod,
              },
            },
          ],
          payer: {
            email_address: req.body.email,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': paypalRequestId,
          },
        },
      );
      console.log("after CreateOrdercheckoutOrder.data");
      console.log(checkoutOrder.data);
      return { success: true, data: checkoutOrder.data };
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return { success: false, error: error.response.data };
    }

  }

    const createOrderWithoutCard = async (req, res) => {
    try {
      const constCreateOrder = await createOrderWithoutCardl(req);
console.log("inside CreateOrder");
      console.log(constCreateOrder.data);

 console.log(constCreateOrder.success === true);
 console.log(constCreateOrder.success);
 console.log(constCreateOrder.data);
      if (constCreateOrder?.success) {
        console.log("before return success")
        return res.status(200).json({ success: true, data: constCreateOrder.data });
      }

      return res.status(500).json({ success: false, error: constCreateOrder.error });
    } catch (error) {
      console.log('error');
      console.log(error);
console.log(error.response);

      return res.status(500).json({ success: false, error: error.response });
    }
  };


  const orderCapture = async (req, res) => {
    try {
      const orderCap = await orderCapturel(req);
      return res.status(201).json(orderCap);
    } catch (error) {
      console.log('error');
      console.error('OrderCapture Error:', error.response?.data || error.message);
      return res.status(401).json({ 'OrderCapture Error': error.response?.data || error.message });
    }
  };

  async function orderCapturel(req) {
    console.log('inside orderCapture');
    console.log('before authorId');
    // CreateOrder response body if sent withCard is default
    /*
    const authorId = req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      ? req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      : req.purchase_units[0]?.payments?.authorizations[0]?.id;
    */
    const authorId = req.body?.authorId;
    console.log(authorId);
    // console.log(req.purchase_units[0]?.payments?.authorizations);
    // console.log(req.purchase_units[0]?.payments?.authorizations[0]?.id);
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    try {
      console.log('ins captureAuthorisation');
      const capturePayment = await axios.post(
        `${process.env.BASE_URL}/v2/payments/authorizations/${authorId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(capturePayment);

      return capturePayment.data;
    } catch (error) {
      console.log('error');
      console.error('capturePayment Error:', error.response?.data || error.message);
      return error.response?.data;
    }
  }

  const voidPayment = async (req, res) => {
    try {
      const voidPymnt = await voidPaymentl(req);
      return res.status(201).json(voidPymnt);
    } catch (error) {
      console.log('error');
      console.error('Void Payment Error:', error.response?.data || error.message);
      return res.status(401).json({ VoidPaymentError: error.response?.data || error.message });
    }
  };

  async function voidPaymentl(req) {
    console.log('inside voidPaymentl');
    console.log('before authorId');
    // CreateOrder response body if sent default withCard
    /*
    const authorId = req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      ? req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      : req.purchase_units[0]?.payments?.authorizations[0]?.id;
    // console.log(req.purchase_units[0]?.payments?.authorizations);
    // console.log(req.purchase_units[0]?.payments?.authorizations[0]?.id);
    
      */
    const authorId = req.body?.authorId;
    console.log(authorId);
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    try {
      console.log('ins voidPayment');
      const voidPyment = await axios.post(
        `${process.env.BASE_URL}/v2/payments/authorizations/${authorId}/void`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(voidPyment);

      return voidPyment.data;
    } catch (error) {
      console.log('error');
      console.log(error);
      console.error('voidPayment Error:', error.response?.data || error.message);
      return error.response?.data;
    }
  }

  const orderAuthorize = async (req, res) => {
    try {
      const ordAut = await orderAuthorizel(req);
      console.log(ordAut);
      return res.status(200).json(ordAut);
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return res.status(401).json(error.response.data);
    }
  };

  // const orderAuthorize = async (req, res) => {
  async function orderAuthorizel(req) {
    console.log('orderAuthorize');
    console.log('req.query.params.id');
    console.log(req.query);
    console.log(req.query.id);
    
    const orderId = req.query.id;
    const accessToken = await getPayPalAccessTokenl();
    console.log(req.body.card);
    // const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    // const { cardNumber, expiry, cvv } = req.body.data.card;
    // const { amt } = req.body.data;
    
    const { cardNumber, expiry, cvv } = req.body.card;
    const { amt } = req.body;
    console.log(cardNumber, expiry, cvv, amt);
    const [expmm, , expyy] = expiry.split('/');
    console.log(`${expmm} - ${expyy}`);

    console.log('before orderAuthorize post');
    console.log(orderId);

    try {
      console.log('before authorize');
      const authoriseOrder = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders/${orderId}/authorize`,

        {
          payment_source: {
            // pass the card details directly

            card: {
              number: cardNumber,
              expiry: `${expyy}-${expmm}`, // yyyy-mm API expected format
              security_code: cvv,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('orderAuthorize:');
      console.log(authoriseOrder.data);
      return authoriseOrder.data;
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return error.response.data;
    }
  }


 
  // const orderAuthorize = async (req, res) => {
  async function orderAuthorizeWithoutCardl(req) {
    console.log('orderAuthorize');
    console.log('req.query.params.id');
    console.log(req.body);
    const orderId = req.body.id;
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log('before orderAuthorize post');
    console.log(orderId);

    try {
      console.log('before authorize');
      const authoriseOrderWithoutCard = await axios.post(
        
        `${process.env.BASE_URL}/v2/checkout/orders/${orderId}/authorize`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('orderAuthorize:');
      console.log(authoriseOrderWithoutCard.data);
      return authoriseOrderWithoutCard.data;
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return error.response.data;
    }
  }

   const orderAuthorizeWithoutCard = async (req, res) => {
    try {
      const ordAutWithoutCard = await orderAuthorizeWithoutCardl(req);
      console.log(ordAutWithoutCard);
      return res.status(200).json(ordAutWithoutCard);
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return res.status(401).json(error.response.data);
    }
  };

  const cardValidation = async (req, res) => {
    // async function cardValidation(req) {
    //    const accessToken = await getPayPalAccessTokenl();
    try {
      console.log('inside cardValidation');

      console.log(req.body.requestor);
      console.log(req.body);
      // console.log(name);
      const { cardNumber, expiry, cvv } = req.body;
      console.log(cardNumber, expiry, cvv);
      console.log('before calling getPayPal');

      console.log('before cardNumber validation');
      const cardNumberValidation = valid.number(cardNumber);
      console.log(cardNumberValidation);

      if (cardNumberValidation.card) {
        console.log(cardNumberValidation.card.type); // 'visa'
      }
      if (!cardNumberValidation.isValid) {
        console.log('Invalid CardNumber');
        return res.status(401).json({ error: 'Invalid CardNumber' });
      }

      console.log('before expiry date validation');

      if (!expiry || typeof expiry !== 'string') {
        return res.status(401).json({ error: 'Expiry Date is required and must be a string' });
      }

      // Validate format mm/dd/YYYY
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!dateRegex.test(expiry)) {
        return res
          .status(400)
          .json({ error: 'Invalid expiry format. Use MM/DD/YYYY (e.g., 01/31/2025)' });
      }

      console.log('before valid.expirationDate');
      const [expmm, , expyy] = expiry.split('/');
      console.log(`${expmm} - ${expyy}`);
      const expDate = `${expmm}/${expyy}`; // validate api expected format mm/yyyy
      console.log(expDate);
      const expDateValidation = valid.expirationDate(expDate);

      console.log(expDateValidation);

      if (!expDateValidation.isValid) {
        return res.status(401).json({ error: 'Invalid expiration date' });
      }
      const { name } = req.body;
      console.log('before cardName validation');
      console.log(name);
      const cardholderNameValidation = valid.cardholderName(name);
      console.log(cardholderNameValidation);

      if (!cardholderNameValidation.isValid) {
        return res.status(401).json({ error: 'Invalid cardholder name' });
      }

      console.log('before cvv validation');

      const cvvValidation = valid.cvv(cvv);
      console.log(cvvValidation);
      if (!cvvValidation.isValid) {
        return res.status(401).json({ error: 'Invalid cvv' });
      }
      return true;
    } catch (error) {
      console.log('error');
      console.log(error);
      return res.status(500).json(error.response);
    }
  };
  // US Phone number validation
  function isValidUSPhoneNumber(number) {
    const regex = /^(?:\+1\s?)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})$/;
    return regex.test(number);
  }

  const postBidsAndPay = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log('req.requestor');

    console.log(req.requestor);

    console.log(req.body);
    console.log(req.body.requestor);

    try {
      const isValidCard = await cardValidation(req, res);
      console.log('isValidCard');
      console.log(isValidCard);
      if (isValidCard !== true) return res;

      const isValidPhoneNumber = isValidUSPhoneNumber(req.body.phone);
      console.log('isValidPhoneNumber');
      console.log(isValidPhoneNumber);
      if (isValidPhoneNumber !== true)
        return res.status(500).json({ success: false, error: 'Invalid PhoneNumber' });

      const userExists = await Users.findOne({ email: req.body.email });
      if (!userExists) {
        return res.status(500).json({ success: false, error: 'Invalid email' });
      }
      console.log(userExists);

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return res.status(500).json({ success: false, error: 'Invalid listingId' });
      }
      console.log(listingsExists);

      console.log('before create Orders With Cardl');

      const createOrdersC = await createOrderl(req);
      console.log('createOrdersC');
      console.log(createOrdersC);

      if (createOrdersC?.success === false) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: createOrdersC?.error });
      }
      console.log(' condition false');
      console.log(createOrdersC);
      // return res.status(201).json({ success: true, data: createOrdersWithCardC.data });
      console.log(req.body.requestor);
      const postBidsResponse = await postBidsloc(req,createOrdersC.data);
      console.log('postBidsResponse');
      console.log(postBidsResponse);
      if (postBidsResponse?.status !== 200) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postBidsResponse?.error });
      }

      const postPaymnts = await postPayments(
        req,
        createOrdersC.data,
        postBidsResponse?.data,
      );
      console.log('postPayments');
      console.log(postPaymnts);

      if (postPaymnts?.success === false) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postPaymnts?.error });
      }

      return res.status(201).json({ success: true, data: postPaymnts?.data });

      // const capturePayment = await orderCapturel(createOrdersWithCardC);
      // console.log(capturePayment);
      // return res.status(201).json(capturePayment);
    } catch (error) {
      console.log('error');

      console.log(error);
      return res.status(500).json(error.response);
    }
  };

  const postBidsAndPayWithoutCard = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log('req.requestor');

    console.log(req.requestor);

    console.log(req.body);
    console.log(req.body.requestor);

    try {
      
      
      const userExists = await Users.findOne({ email: req.body.email });
      if (!userExists) {
        return res.status(500).json({ success: false, error: 'Invalid email' });
      }
      console.log(userExists);

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return res.status(500).json({ success: false, error: 'Invalid listingId' });
      }
      console.log(listingsExists);

      console.log('before createOrder');

    
      // const createOrdersWithoutCardC = await createOrder(req,res);
      const createOrdersWithoutCardC = await createOrderWithoutCardl(req);
      
      console.log('createOrdersWithoutCardC');
      console.log(createOrdersWithoutCardC);

      if (createOrdersWithoutCardC?.success === false) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: createOrdersWithoutCardC?.error });
      }
      console.log(' condition false');
      console.log(createOrdersWithoutCardC);
      console.log(createOrdersWithoutCardC.data);
    

      const postBidsResponse = await postBidsloc(req, createOrdersWithoutCardC.data);
      console.log('postBidsResponse');
      console.log(postBidsResponse);
      if (postBidsResponse?.status !== 200) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postBidsResponse?.error });
      }
      console.log("createOrdersWithoutCardC.data before postPaymnts");
      console.log(createOrdersWithoutCardC.data);
      
      const postPaymnts = await postPaymentsWithoutCard(
        req,        
        createOrdersWithoutCardC.data,
        postBidsResponse?.data,
      );
      console.log('postPayments');
      console.log(postPaymnts);

      if (postPaymnts?.success === false) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postPaymnts?.error });
      }

      return res.status(201).json({ success: true, data: postPaymnts?.data });

      // const capturePayment = await orderCapturel(createOrdersWithCardC);
      // console.log(capturePayment);
      // return res.status(201).json(capturePayment);
    } catch (error) {
      console.log('error');

      console.log(error);
      return res.status(500).json(error.response);
    }
  };

  // async function updateOrderLocal(req) {
  const updateOrderLocal = async  (req) => {
    console.log("updateOrderLocal");
    console.log(req);
    if (!ready ) throw new Error('Bids Controllere Init not ready!');
    console.log(req.body);

    const accessToken = await getPayPalAccessTokenl();

    console.log(accessToken);
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { bidPrice,listingId,startDate, endDate,paypalOrderId, email } = req ?? req.body;
    console.log(listingId);
    console.log(paypalOrderId);
    const userExists = await Users.findOne({ email });

    if (!userExists) {
      return { status: 400, error: 'Invalid email' };
    }
    console.log(userExists);
    const bidExists = paypalOrderId ? await Bids.findOne({ paypalOrderId})
                              : await Bids.findOne({ listingId, 
                                           startDate,
                                           endDate
                                            });
    
    if (!bidExists) {
      return { status: 400, error: 'Invalid matching details' };
    }
    console.log(bidExists);
    console.log(bidExists.biddingHistory.length);
    const lastBid = bidExists.biddingHistory[bidExists.biddingHistory.length - 1];
    console.log(lastBid);
    console.log(!lastBid);
    const firstBid = bidExists.biddingHistory[0];
    console.log(firstBid);
    console.log(!firstBid);

    const oldBidPrice = firstBid.bidPrice;
    console.log("oldBidPrice.toString()");
    
    console.log(oldBidPrice.toString());
    // const payerEmailAddress = req.body.email;
    // console.log('payerEmailAddress');
    // console.log(payerEmailAddress);

    // First, find the index of the correct purchase_unit

    const rentalPeriod = await getRentalPeriod(bidExists.startDate, 
                                         bidExists.endDate);
    console.log(`rentalPeriod is ${rentalPeriod}`);
    console.log(`bidPrice is ${bidPrice}`);
    
    const paymentExists = await Payments.findOne({
      paypalOrderId: {
        $in: [bidExists.paypalOrderId],
      },
    });
    console.log(paymentExists);
    // getRentalPeriod(startDate, endDate)

    // https://api-m.sandbox.paypal.com/v2/checkout/orders/{id}

    try {
      const paypalOrder = await axios.get(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
     // console.log('paypalOrder.data.purchase_units');
     // console.log(paypalOrder.data.purchase_units);
     console.log("paypalOrder.data");

     console.log(paypalOrder.data);

      const units = paypalOrder.data.purchase_units;
      console.log(units[0].amount.toString())
      console.log(units[0].amount)
      
      // const referenceIndex = units.findIndex((u) => u.reference_id === '$[oldBidPrice.toString()}');
      const referenceIndex = units.findIndex((u) => u.reference_id === oldBidPrice.toString());
      
      console.log('referenceIndex');

      console.log(referenceIndex);
      
      console.log(units[0].amount);
      console.log('/purchase_units/reference_id:/amount');
      console.log(`/purchase_units/reference_id:${oldBidPrice.toString()}/amount`);
      console.log('/purchase_units/0/amount');
      // return { success: true, data: paypalOrder.data }; 

      const updateOrd = await axios.patch(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        [
          {
            op:  "replace",
            //   path: `/purchase_units/0/amount/`,
            // path: `/purchase_units/0/amount/`,
            //  "path": "/purchase_units/@reference_id=='default'/amount",
            // path: `/purchase_units/reference_id:${oldBidPrice.toString()}/amount`,
        //     path: `/purchase_units/${referenceIndex}/amount`,
        path: `/purchase_units/@reference_id=='${oldBidPrice.toString()}'/amount`,

            value: {
              currency_code: 'USD',
              value: rentalPeriod * bidPrice,
              /* breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: rentalPeriod * bidPrice,
                },
              }, */ 
            },
          }, 
        /*   {
        op: "add",
        path: `/purchase_units/@reference_id=='${oldBidPrice.toString()}'/invoice_id`,
//   path: `/purchase_units/@reference_id=='410'/invoice_id`,

      //  "path": "/purchase_units/@reference_id=='default'/invoice_id",
        "value": "03012022-3303-05"
    } */
        ],
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': paypalRequestId,
          },
        },
      ); 
      // method PATCH

      console.log(updateOrd.data);
      const afterPatchPaypalOrder = await axios.get(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
     // console.log('paypalOrder.data.purchase_units');
     // console.log(paypalOrder.data.purchase_units);
     console.log("afterPatchPaypalOrder.data");

     console.log(afterPatchPaypalOrder.data);

      return { success: true, data: afterPatchPaypalOrder.data }; 
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return { success: false, error: error.response.data };
    }
  }

  const updateOrder = async (req, res) => {
    try {
      const updOrd = await updateOrderLocal(req);

      return res.status(200).json(updOrd);
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return res.status(500).json(error.response.data);
    }
  };

  // async function orderCheckoutNowLocal(req){
  const  orderCheckoutNowLocal = async (req) => {
  console.log("orderCheckoutNowLocal");
    
    if (!ready ) throw new Error('Bids Controllere Init not ready!');
    console.log(req);
    console.log(req.body)
    const {paypalOrderId} = req ?? req.body;
    const outUrl = req.hrefLink ?? req.body.hrefLink;
    console.log("orderCheckoutNowLocal inside");
    console.log(`paypalOrderId is ${paypalOrderId}`);
    console.log(`outUrl is ${outUrl}`);
    
   
   try
    {
    const bidExists = await Bids.findOne({ paypalOrderId });
    if (!bidExists) {
      return { status: 400, error: 'Invalid orderId' };
    }
    console.log(bidExists);
    
    const userExists = await Users.findOne({ _id: bidExists.userId });
    if (!userExists) {
      return { status: 400, error: 'Invalid email' };
    }
    console.log(userExists);

console.log(userExists.name);
    
      console.log('before checkoutnow post');
      const emailPaymentApprovalBody = `   
    <p> Hi ${userExists.name} </p>

<p> Thank you for your order!</p>

<p> To complete your payment securely through PayPal, please click the link below:</p>

<p>👉 Complete Your Payment <a href="${outUrl}">Click here to approve payment</a> </p>

<p> This will open the PayPal checkout page where you can review and approve your payment.</p>

<p> If you have any questions or run into any issues, feel free to reply to this email and we’ll be happy to help.</p>

<p>Best regards,</p>
<p>One Community global</p>`;

console.log(emailPaymentApprovalBody);
 

  await emailSender(
    userExists.email, // toEmailAddress
    'Approve Your Payment via PayPal', // subject
    emailPaymentApprovalBody, // message
    null, // attachments
    null, //  cc
    'onecommunityglobal@gmail.com', // reply to
  );
    console.log('Email sent successfully.');
     return { success: true, data: 'Email sent successfully.' }; 
   
     } catch (error) {
      console.log('error');
      console.log(error.response.data);
     return { success: false, data: 'Error in sending the Email' }; 
    } 
    /* } catch (error) {
      console.log('error');
      console.error(
        'checkoutnow:',
        error.response?.data?.details?.description || error.message,
      );
      return error.response?.data;
    } */
  }
  const orderCheckoutNow = async (req, res) => {
      
    console.log(req.body);
    try {
      const ordChkoutNow = await orderCheckoutNowLocal(req);

      return res.status(200).json(ordChkoutNow.data);
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return res.status(500).json(error.response.data);
    }
    
  };

  // below this line not used

  const oldpostPayment = async (req, res) => {
    // const paymentCardToken = getPaymentCardToken();
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log(req.body);
    console.log('before checkout/orders');
    //      res.status(200).json({ success: false, data: orderPayment.data });
    const createOrdersWithCardC = await createOrderWithoutCard(req.body);
    console.log('createOrdersWithCardC');
    console.log(createOrdersWithCardC);
    // return res.status(201).json(createOrdersWithCardC);

    const createOrders = await createOrder(req.body.data);
    console.log('createOrders');
    console.log(createOrders);

    // console.log('1 captureAuthorisation');
    // console.log(createOrdersWithCard.purchase_units);
    // console.log('2 captureAuthorisation');

    // console.log(createOrdersWithCard.purchase_units[0]?.payments);
    //  console.log('3 captureAuthorisation');

    // console.log(createOrdersWithCard.purchase_units[0]?.payments.authorizations[0]?.id);

    const orderAutho = await orderAuthorize(createOrders, req.body.data);
    console.log(orderAutho);

    // return res.status(201).json(orderAutho);

    const captureAuthorise = await captureAuthorisation(orderAutho.data);
    console.log(captureAuthorise);
    return res.status(201).json(captureAuthorise);

    /*
    // console.log('before paymentAuthorisation');
    // const pymntAuthorisation = await paymentAuthorisation(createOrdersWithCard);
    // console.log(pymntAuthorisation);
    
    console.log('before checkoutnowPost');
    const checkoutnowPost = await checkoutNowPost(createOrders);
    console.log(checkoutnowPost);
    console.log('before confirmPymentSource');
    const confirmPymentSource = await confirmPaymentSource(createOrders);
    console.log(confirmPymentSource); */
  };

  const checkoutOrdersWithToken = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();
    console.log(req.id);
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    try {
      const orderPaymentWithToken = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', // 'CAPTURE',
          purchase_units: [
            {
              reference_id: 'someValue',
              amount: {
                currency_code: 'USD',
                value: 70,
              },
            },
          ],
          payment_source: {
            token: {
              id: req.id,
              type: 'SETUP_TOKEN', // not able to approve
              //     type: 'PAYMENT_METHOD_TOKEN', //no authorisation
            },
          },
          payer: {
            email_address: req.body.payer_email_address,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': paypalRequestId,
          },
        },
      );
      console.log(orderPaymentWithToken.data);
      return orderPaymentWithToken.data;
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
    }
  };

  const paymentAuthorisation = async (req, res) => {
    console.log('inside paymentAuthorisation');
    console.log(req.id);
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);

    // const paymentCardToken = getPaymentCardToken();

    const paymentCardToken = {
      // intent: 'sale',
      payment_source: {
        card: {
          number: '2223000048400011',
          expiry: '2025-11',
          cvv: '123',
        },
      },
    };
    console.log(paymentCardToken);

    try {
      const response = await axios.post(
        `${process.env.BASE_URL}/v3/vault/payment-tokens`,
        paymentCardToken,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
    // trying this
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    try {
      console.log('before authorizePyment');
      const authorizePyment = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders/${req.id}/authorize`,
        {
          payment_source: {
            token: {
              id: response.data.id,
              type: 'PAYMENT_METHOD_TOKEN',
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            // 'PayPal-Request-Id': paypalRequestId,
          },
        },
      );
      console.log(authorizePyment.result);
      return authorizePyment.result.purchase_units[0].payments.authorizations[0].id;
      // return authorizePyment.data;
    } catch (error) {
      console.log('error');
      console.error('Authorise Pyment Error:', error.response?.data || error.message);
      return error.response?.data;
    }
  };

function init() {
  ready = true;
}

  
  // above this line not used
  return {
    getBids,
    postBids,
    getPaymentCardToken,
    postBidsAndPay,
    postBidsAndPayWithoutCard,    
    getPayPalAccessToken,
    createOrderWithoutCard,
    createOrder,
    orderAuthorize,
    orderAuthorizeWithoutCard,
    orderCapture,
    voidPayment,
    updateOrder,
    updateOrderLocal,
    orderCheckoutNow,
    orderCheckoutNowLocal,    
    init
  };
};

module.exports = bidsController;
console.log('bidsController.js: typeof module.exports:', typeof module.exports);
console.log('[bc.js] loaded completed');

