const axios = require('axios');

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

  async function getPayPalAccessToken() {
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
    } catch (error) {
      console.error('get PayPalAccessToken Error:', error.response?.data || error.message);
    }
  }
  const postBids = async (req, res) => {
    try {
      const { listingId, requestor, termsAgreed, startDate, endDate, price } = req.body;

      console.log(req.body);

      if (!listingId) {
        return res.status(401).json({ error: 'listingId cannot be empty' });
      }

      if (!requestor?.requestorId) {
        return res.status(401).json({ error: 'userId cannot be empty' });
      }
      if (!termsAgreed) {
        return res.status(401).json({ error: 'termsAgreed cannot be empty' });
      }
      if (!startDate) {
        return res.status(401).json({ error: 'startDate cannot be empty' });
      }
      if (!endDate) {
        return res.status(401).json({ error: 'endDate cannot be empty' });
      }
      if (endDate <= startDate) {
        return res.status(401).json({ error: 'endDate should be greater than the startDate' });
      }
      if (!price) {
        return res.status(401).json({ error: 'price should be greater than 0' });
      }

      const [startDay, startMonth, startYear] = req.body.startDate.split('/');
      const [endDay, endMonth, endYear] = req.body.endDate.split('/');

      const stDate = new Date(`${startYear}-${startMonth}-${startDay}`);
      const enDate = new Date(`${endYear}-${endMonth}-${endDay}`);

      const rentalPeriod = (enDate - stDate) / (1000 * 60 * 60 * 24);

      console.log(`rentalPeriod in days: ${rentalPeriod}`);
      console.log(rentalPeriod * price);
      const newBidsData = { ...req.body, userId: req.body.requestor.requestorId };
      const newBids = new Bids(newBidsData);
      console.log(newBids);
      const savedBids = await newBids.save();
      // console.log(savedBids);
      res.status(201).json(savedBids);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  const getBids = async (req, res) => {
    console.log('getBids');
    try {
      console.log('inside getBids');
      Bids.findOne({ isActive: { $ne: false } })
        .select('userId listingId startDate price -_id')
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

  const getPaymentCardToken = async (req, res) => {
    console.log('getPaymentCardToken');
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
    const expDate = `${expmm}/${expyy}`; // api expected format mm/yyyy
    console.log(expDate);
    const expDateValidation = valid.expirationDate(expDate);
    // `${expmm} / ${expyy}`);

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
    const accessToken = await getPayPalAccessToken();
    console.log(accessToken);
    console.log(expDate);
    try {
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
    /*
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
      return res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(
        'PayPal Payment Token Error:',
        error.response?.data?.details?.description || error.message,
      );
      res
        .status(500)
        .json({ success: false, error: error.response?.data?.details[0]?.description });
    } */
  };
  const checkoutOrders = async (req, res) => {
    const accessToken = await getPayPalAccessToken();

    try {
      const orderPayment = await axios.post(
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
            // token:
            card: {
              id: req.id,
              type: 'SETUP_TOKEN',
              name: req.payment_source.card.name,
              last_digits: req.payment_source.card.last_digits,
              brand: req.payment_source.card.brand,
              expiry: req.payment_source.card.expiry,
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
      console.log(orderPayment.data);
      return orderPayment.data;
    } catch (error) {
      console.log('error');
      console.log(error);
    }
  };
  const paymentAuthorisation = async (req, res) => {
    console.log('inside paymentAuthorisation');
    console.log(req.id);
    const accessToken = await getPayPalAccessToken();

    try {
      console.log('before authorizePyment');
      const authorizePyment = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders/${req.id}/authorize`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log(authorizePyment.data);
      return authorizePyment.data;
    } catch (error) {
      console.log('error');
      console.error(
        'Authorise Pyment Error:',
        error.response?.data?.details?.description || error.message,
      );
      return error.response?.data?.details[0]?.description;
    }
  };
  const checkoutNowPost = async (req, res) => {
    const accessToken = await getPayPalAccessToken();

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
  const confirmPaymentSource = async (req, res) => {
    const accessToken = await getPayPalAccessToken();

    console.log('before confirmPaymentSource post');
    console.log(req.id);

    try {
      // https://api-m.sandbox.paypal.com/v2/checkout/orders/{id}/confirm-payment-source
      const confirmPymtSource = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders/${req.id}/confirm-payment-source`,
        {
          payment_source: {
            token: {
              id: req.id,
              // type: 'SETUP_TOKEN',
              // type: 'PAYMENT_TOKEN',
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
      console.log('Order Manually Approved:', confirmPymtSource.data);
      return confirmPymtSource.data;
    } catch (error) {
      console.log('error');
      console.log(error.response.data);
    }
  };
  const authorisePayment = async (req, res) => {
    // const paymentCardToken = getPaymentCardToken();
    const accessToken = await getPayPalAccessToken();
    console.log(accessToken);
    console.log(req.body.data.id);
    console.log('before checkout/orders');
    //      res.status(200).json({ success: false, data: orderPayment.data });
    const createOrders = await checkoutOrders(req.body.data);
    console.log(createOrders);
    console.log('before paymentAuthorisation');
    const pymntAuthorisation = await paymentAuthorisation(createOrders);
    console.log(pymntAuthorisation);
    console.log('before checkoutnowPost');
    const checkoutnowPost = await checkoutNowPost(createOrders);
    console.log(checkoutnowPost);
    console.log('before confirmPymentSource');
    const confirmPymentSource = await confirmPaymentSource(createOrders);
    console.log(confirmPymentSource);
  };
  return { getBids, postBids, getPaymentCardToken, authorisePayment };
};

module.exports = bidsController;
