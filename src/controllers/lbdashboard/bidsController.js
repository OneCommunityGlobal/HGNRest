const axios = require('axios');
const Payments = require('../../models/lbdashboard/payments');
const Users = require('../../models/lbdashboard/users');
const Listings = require('../../models/lbdashboard/listings');
const paymentController = require('./paymentsController');

const paymentControllerInstance = paymentController(Payments);

const { postPayments } = paymentControllerInstance;

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

  const parseDate = (dateStr) => {
    const [month, day, year] = dateStr.split('/'); // Extract parts
    return new Date(`${month}-${day}-${year}`); // Convert to YYYY-MM-DD format
  };

  const postBidsloc = async (req) => {
    try {
      const { listingId, requestor, termsAgreed, bidPrice, email } = req.body;
      const inStartDate = parseDate(req.body.startDate);
      const inEndDate = parseDate(req.body.endDate);

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

      if (!requestor?.requestorId) {
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

      const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);

      console.log(`rentalPeriod in days: ${rentalPeriod}`);
      console.log(rentalPeriod * bidPrice);
      const newBidsData = { ...req.body, userId: userExists._id };
      const newBids = new Bids(newBidsData);
      console.log(newBids);
      const savedBids = await newBids.save();
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

  const createOrderWithCard = async (req, res) => {
    try {
      const constCreatOrderWithCard = await createOrderWithCardl(req);
      console.log('after local call');
      console.log(constCreatOrderWithCard);

      console.log(constCreatOrderWithCard.success === true);
      if (constCreatOrderWithCard?.success) {
        return res.status(201).json({ success: true, data: constCreatOrderWithCard });
      }

      return res.status(500).json({ success: false, error: constCreatOrderWithCard.error });
    } catch (error) {
      console.log('error');
      console.log(error.response);

      return res.status(500).json({ success: false, error: error.response });
    }
  };

  // const checkoutOrderWithCard = async (req, res) => {

  async function createOrderWithCardl(req) {
    console.log(req.body);

    const accessToken = await getPayPalAccessTokenl();

    console.log(accessToken);
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { cardNumber, expiry, cvv } = req.body;
    const { bidPrice } = req.body;
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
              reference_id: 'greatReference',
              amount: {
                currency_code: 'USD',
                value: rentalPeriod * bidPrice,
              },
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
      console.log(error.response.data);
      return { success: false, error: error.response.data };
    }
  }

  const createOrder = async (req, res) => {
    try {
      const constCreateOrder = await createOrderl(req);

      return res.status(200).json(constCreateOrder);
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return res.status(500).json(error.response.data);
    }
  };

  async function createOrderl(req) {
    const accessToken = await getPayPalAccessTokenl();
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { amt } = req.body.data;
    console.log(amt);

    try {
      const checkoutOrder = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', // 'CAPTURE'

          purchase_units: [
            {
              reference_id: 'OrderReference',
              amount: {
                currency_code: 'USD',
                value: amt,
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
      console.log(checkoutOrder.data);
      return checkoutOrder.data;
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
      return error.response.data;
    }
  }

  const orderCapture = async (req, res) => {
    // return capturePayment.data;
    try {
      const orderCap = await orderCapturel(req);
      return res.status(201).json(orderCap);
    } catch (error) {
      console.log('error');
      console.error('OrderCapture Error:', error.response?.data || error.message);
      return res.status(401).json({ 'OrderCapture Error': error.response?.data || error.message });
    }
  };
  // const orderCapture = async (req, res) => {
  async function orderCapturel(req) {
    console.log('inside orderCapture');
    console.log('before authorId');
    const authorId = req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      ? req.body?.purchase_units[0]?.payments?.authorizations[0]?.id
      : req.purchase_units[0]?.payments?.authorizations[0]?.id;
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
    const orderId = req.query.id;
    const accessToken = await getPayPalAccessTokenl();
    console.log(req.body.data.card);
    // const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { cardNumber, expiry, cvv } = req.body.data.card;
    const { amt } = req.body.data;
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
    console.log(req.body);

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

      console.log('before createOrdersWithCardl');

      const createOrdersWithCardC = await createOrderWithCardl(req);
      console.log('createOrdersWithCardC');
      console.log(createOrdersWithCardC);

      if (createOrdersWithCardC?.success === false) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: createOrdersWithCardC?.error });
      }
      console.log(' condition false');
      console.log(createOrdersWithCardC);
      // return res.status(201).json({ success: true, data: createOrdersWithCardC.data });

      const postBidsResponse = await postBidsloc(req);
      console.log('postBidsResponse');
      console.log(postBidsResponse);
      if (postBidsResponse?.status !== 200) {
        console.log('inside 500');
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postBidsResponse?.error });
      }

      const postPaymnts = await postPayments(
        req,
        createOrdersWithCardC.data,
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

  // below this line not used

  const oldpostPayment = async (req, res) => {
    // const paymentCardToken = getPaymentCardToken();
    const accessToken = await getPayPalAccessTokenl();
    console.log(accessToken);
    console.log(req.body);
    console.log('before checkout/orders');
    //      res.status(200).json({ success: false, data: orderPayment.data });
    const createOrdersWithCardC = await createOrderWithCard(req.body);
    console.log('createOrdersWithCardC');
    console.log(createOrdersWithCardC);
    return res.status(201).json(createOrdersWithCardC);

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

  const checkoutNowPost = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();

    try {
      console.log('before checkoutnow post');
      // href: 'https://www.sandbox.paypal.com/checkoutnow?token=8TS64434HU813854C',
      // rel: 'approve',
      // method: 'GET'
      const checkoutNowPayment = await axios.get(
        `${process.env.BASE_URL}/checkoutnow?token=${req.id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Order Manually Approved:', checkoutNowPayment);
    } catch (error) {
      console.log('error');
      console.error(
        'checkoutnowPost:',
        error.response?.data?.details?.description || error.message,
      );
      return error.response?.data;
    }
  };

  // above this line not used
  return {
    getBids,
    postBids,
    getPaymentCardToken,
    postBidsAndPay,
    getPayPalAccessToken,
    createOrderWithCard,
    createOrder,
    orderAuthorize,
    orderCapture,
  };
};

module.exports = bidsController;
