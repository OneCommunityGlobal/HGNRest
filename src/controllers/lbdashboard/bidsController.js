let ready = false;

const axios = require('axios');
const Payments = require('../../models/lbdashboard/payments');
const Users = require('../../models/lbdashboard/users');
const Listings = require('../../models/lbdashboard/listings');
const BidDeadlines = require('../../models/lbdashboard/bidDeadline');
const paymentController = require('./paymentsController');

const paymentControllerInstance = paymentController(Payments);
const { addBidToHistory } = require('./bidDeadlinesController')();

const { postPayments, postPaymentsWithoutCard, postPaymentUpdateOrderWithoutCard,
  postPaymentAuthorizationsWithoutCard,postPaymentCheckoutNowWithoutCard
, postPaymentStatusWithoutCard } = paymentControllerInstance;
const { getIO } = require('../../sockets/BiddingService/connServer');
const emailSender = require('../../utilities/emailSender');

const parseDate = (dateStr) => {
    const [month, day, year] = dateStr.split('/'); // Extract parts
    return new Date(`${month}-${day}-${year}`); // Convert to YYYY-MM-DD format
  };


  async function getRentalPeriod(startDate, endDate) {
    const inStartDate = startDate.toString().includes('/') ? parseDate(startDate) :startDate;
    const inEndDate = endDate.toString().includes('/') ?parseDate(endDate):endDate

    const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);

    return rentalPeriod;
  }

const bidsController = function (Bids) {

  
  const postBidsloc = async (req, ordDetails) => {
    try {
      const { listingId, requestor, termsAgreed, email } = req.body;
      const { bidPrice } = req.body.biddingHistory;
      

      const inStartDate = parseDate(req.body.startDate);
      const inEndDate = parseDate(req.body.endDate);


      const userExists = await Users.findOne({ email });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }

      if (!listingId) {
        return { status: 400, error: 'listingId cannot be empty' };
      }

      const listingsExists = await Listings.findOne({ _id: listingId });
      if (!listingsExists) {
        return { status: 400, error: 'Invalid listingId' };
      }

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

      const rentalPeriod = await getRentalPeriod(req.body.startDate, req.body.endDate)



      const paypalCheckoutNowLink =  ordDetails?.links.find((u) => u.href.includes('checkoutnow'))
      const newBidsData = { ...req.body, userId: userExists._id, paypalOrderId : ordDetails?.id, 
        paypalCheckoutNowLink:paypalCheckoutNowLink?.href };

      const newBids = new Bids(newBidsData);
      const savedBids = await newBids.save();
      
      const io = getIO();
      if (io) {
        io.emit('bid-updated', `current bid price is ${bidPrice}`);
      }

      const savedBidHistory = await addBidToHistory(BidDeadlines, listingId, bidPrice);
      if (savedBidHistory?.status !== 200) {
        return {status: 500, error: savedBidHistory?.error };
      }



      return { status: 200, data: savedBids };
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error'  };
    }
  };

  const postBids = async (req, res) => {
    try {
      const savedBids = await postBidsloc(req);
      if (savedBids !== 200) return res.status(500).json({ success: false, error: savedBids.error });
      res.status(200).json({ success: true, data: savedBids.data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.response?.data?.error || error.message || 'Unknown error'});
    }
  };

  const getBids = async (req, res) => {
    try {
      const userExists = await Users.findOne({ email:req.body.email });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }
      
      const results = await Bids.find({ userId: userExists._id, isActive: { $ne: false } })
        .select('userId listingId startDate bidPrice -_id');
         return res.status(200).json({ success: true, data:results});
        
    } catch (error) {
       return res.status(500).json({success:false, error: error.response?.data?.error || error.message || 'Unknown error'} );
      
    }
  };

  
  const valid = require('card-validator');

  async function getPayPalAccessTokenl() {
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
      return error.response?.data?.error || error.message || 'PayPalAccessToken error' ;
    }
  }
  const getPayPalAccessToken = async (req, res) => {
    try {
      const payPalAccessToken = await getPayPalAccessTokenl();
      return res.status(200).json({"paypalAccessToken": payPalAccessToken});
    } catch (error) {
      return res
        .status(400)
        .json({ 'Error': error.response?.data?.error || error.message || 'Unknown error getPayPalAccessToken'  });
    }
  };

  const getSetupCardToken = async (req, res) => {
    const { includeCardholderName } = req.query;
    const { cardNumber, expiry, cvv, amt } = req.body.card;
    const cardNumberValidation = valid.number(cardNumber);
   
    if (cardNumberValidation.card) {
      console.log(cardNumberValidation.card.type); // 'visa'
    }
    if (!cardNumberValidation.isValid) {
        return { status: 401, error: 'Invalid CardNumber'};
    }

   
    if (!expiry || typeof expiry !== 'string') {
      return { status: 401, error: 'Expiry Date is required and must be a string' };
    }
    if (!cvv) {
         return { status: 400, error: 'cvv cannot be empty' };
    }
    
    // Validate format mm/dd/YYYY
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dateRegex.test(expiry)) {
      return {
        status: 400, error: 'Invalid expiry format. Use MM/DD/YYYY (e.g., 01/31/2025)' };
    }

    const [expmm, , expyy] = expiry.split('/');
    const expDate = `${expmm}/${expyy}`; // validate api expected format mm/yyyy
    const expDateValidation = valid.expirationDate(expDate);

   
    if (!expDateValidation.isValid) {
      return { status: 401, error: 'Invalid expiration date' };
    }
    const { name } = req.query.includeCardholderName === 'Y' && req.body;
    if (includeCardholderName === 'Y') {
      const cardholderNameValidation = valid.cardholderName(name);
   
      if (!cardholderNameValidation.isValid) {
        return {status: 401, error: 'Invalid cardholder name' };
      }
    }
    const cvvValidation = valid.cvv(cvv);
    if (!cvvValidation.isValid) {
    return {status:401, error: 'Invalid cvv' };
    }
    
    const accessToken = await getPayPalAccessTokenl();
   
    const paymentCardToken = {
      payment_source: {
        card: {
          number: cardNumber,
          expiry: `${expyy}-${expmm}`, // yyyy-mm API expected format
          security_code: cvv,
          name: includeCardholderName === 'Y' ? name : null,
        },
      },
    };
   
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
      return { status:200, data : setupTokenResponse.data };
    } catch (error) {
      return {status:500, error :error.response?.data?.error || error.message || 'PayPal Payment Token Error:'}  ;
    }
  };
  const getPaymentCardToken = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();
    const setupToken = await getSetupCardToken(req);
    if (setupToken.status !== 200) return res.status(500).json({ success: false, error: setupToken.error });
    try {
      const paymentCardToken = {
        payment_source: {
          token: {
            id: `${setupToken.data.id}`,
            type: 'SETUP_TOKEN',
          },
        },
      };
    
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
      res
        .status(500)
        .json({ success: false, error: error.response?.data?.error || error.message || 'Unknown error'  });
    }
  
  };

  
  // const checkoutOrderWithCard = async (req, res) => {

  async function createOrderl(req) {
    
    const accessToken = await getPayPalAccessTokenl();

    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { cardNumber, expiry, cvv } = req.body;
    const { bidPrice } = req.body.biddingHistory;
    const payerEmailAddress = req.body.email;
    
    const inStartDate = parseDate(req.body.startDate);
    const inEndDate = parseDate(req.body.endDate);

    const rentalPeriod = (inEndDate - inStartDate) / (1000 * 60 * 60 * 24);

    const cardNumberValidation = valid.number(cardNumber);
  
        if (!payerEmailAddress) {
        return { status: 400, error: 'Email cannot be empty' };
      }
  
    if (!cardNumberValidation.isValid) {
        return { status: 401,  error: 'Invalid CardNumber' };
      }

    const cvvValidation = valid.cvv(cvv);
      if (!cvvValidation.isValid) {
        return { status:401, error: 'Invalid cvv' };
      }

      
      if (!expiry || typeof expiry !== 'string') {
        return { status: 401, error: 'Expiry Date is required and must be a string' };
      }
      const [expmm, , expyy] = expiry.split('/');

      // Validate format mm/dd/YYYY
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!dateRegex.test(expiry)) {
        return {
          status: 400, error: 'Invalid expiry format. Use MM/DD/YYYY (e.g., 01/31/2025)' };
      }
    const expiryValidation = valid.expirationDate(`${expmm}/${expyy}`);
      if (!expiryValidation.isValid) {
      return { status: 422, error: 'Expiry date is invalid. Use MM/YY format and ensure it’s not expired.' };
        
      }
  

     const userExists = await Users.findOne({ email:payerEmailAddress });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }

      if (!userExists._id) {
        return { status: 400, error: 'userId cannot be empty' };
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

   
    try {
      const checkoutOrder = await axios.post(
        `${process.env.BASE_URL}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', 

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
    return { status: 200, data: checkoutOrder.data };
      
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error in createOrderl'  };
    
    }
  }

  const createOrder = async (req, res) => {
    try {
      const creatOrderC = await createOrderl(req);
      if (creatOrderC?.status !== 200) {
         if (res.headersSent) return;
        return res.status(500).json({ success: false, error: creatOrderC?.error });
       }

      return res.status(200).json({ success: true, data: creatOrderC });
    } catch (error) {
      
      return res.status(500).json({ success: false, error: error.response?.data?.error || error.message || 'Unknown error in createOrderl'  });
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
      return { status: 200, data: checkoutOrder.data };
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error'  };
    }

  }

    const createOrderWithoutCard = async (req, res) => {
    try {
      const constCreateOrder = await createOrderWithoutCardl(req);
      if (constCreateOrder?.status !== 200) {

        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: constCreateOrder?.error });
       }

      return res.status(200).json({ success: true, data: constCreateOrder.data });
    } 

       catch (error) {

      return res.status(500).json({ success: false, error: error.response?.data?.error || error.message || 'Unknown error'  });
    }
  };


  const orderCapture = async (req, res) => {
    try {
      const orderCap = await orderCapturel(req);
      if (orderCap?.status !== 200) {
         if (res.headersSent) return;
        return res.status(500).json({ success: false, error: orderCap?.error });
       }
      const ppSWC = await postPaymentStatusWithoutCard("PAYMENT.CAPTURE.COMPLETED",  req);
      return res.status(200).json({ success: true, data: orderCap.data });
    } 
      catch (error) {
      return res.status(500).json({ success:false, error :error.response?.data?.error || error.message || 'Unknown error orderCapturel'  });
    }
  };

  async function orderCapturel(req) {
    const authorId = req.body?.authorId;
    
    const accessToken = await getPayPalAccessTokenl();
    try {
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
      return {status:200, data: capturePayment.data};
    } catch (error) {
      return {status:500, error: error.response?.data?.error || error.message || 'Unknown error orderCapturel'};
    }
  }
  const voidPayment = async (req, res) => {
    try {
      const voidPymnt = await voidPaymentl(req);
      if (voidPymnt?.status !== 204) {
         if (res.headersSent) return;
        return res.status(500).json({ success: false, error: voidPymnt?.error });
       }

      return res.status(204).json({ success: true, data: voidPymnt.data });
    } 
     catch (error) {
      return res.status(500).json({ success: false, "Error": error.response?.data?.error || error.message || 'Unknown error' });
    }
  };

  async function voidPaymentl(req) {
    const authorId = req.body?.authorId;
    const accessToken = await getPayPalAccessTokenl();
    try {
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
      return { status: 204, data: voidPyment.data };
  
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error' };
    
    }
  }

  const orderAuthorize = async (req, res) => {
    try {
      const ordAut = await orderAuthorizel(req);
      if (ordAut?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: ordAut?.error });
      }
      return res.status(200).json({success:true, data:ordAut.data});
    } catch (error) {
      return res.status(500).json({success:false, error: error.response?.data?.error || error.message || 'Unknown error'});
    }
  };

  const cardValidation = async (req) => {
    try {
      const { cardNumber, expiry, cvv } = req.body.card;
      const cardNumberValidation = valid.number(cardNumber);

      if (cardNumberValidation.card) {
        console.log(cardNumberValidation.card.type); // 'visa'
      }
      if (!cardNumberValidation.isValid) {
        return {status: 401, error: 'Invalid CardNumber' };
      }


      if (!expiry || typeof expiry !== 'string') {
        return {status: 401, error: 'Expiry Date is required and must be a string' };
      }

      // Validate format mm/dd/YYYY
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!dateRegex.test(expiry)) {
        return {status :400, error: 'Invalid expiry format. Use MM/DD/YYYY (e.g., 01/31/2025)' };
      }

      const [expmm, , expyy] = expiry.split('/');
      const expDate = `${expmm}/${expyy}`; // validate api expected format mm/yyyy
      const expDateValidation = valid.expirationDate(expDate);


      if (!expDateValidation.isValid) {
        return { status: 401,  error: 'Invalid expiration date' };
      }
      const { name } = req.body;
      const cardholderNameValidation = valid.cardholderName(name);

      if (!cardholderNameValidation.isValid) {
        return {status:401, error: 'Invalid cardholder name' };
      }

      const cvvValidation = valid.cvv(cvv);
      if (!cvvValidation.isValid) {
        return {status:401, error: 'Invalid cvv' };
      }
      return  {status:200, data:"success"};
    } catch (error) {
      return {status:500, error:error.response?.data?.error || error.message || 'Unknown error'};
    }
  };

  async function orderAuthorizel(req) {
    
    const orderId = req.query.id;
    const accessToken = await getPayPalAccessTokenl();
    

    const cardValid = await cardValidation(req);
    if (cardValid?.status !== 200) {
        return { status: 500, error : cardValid?.error };
      }
    const { cardNumber, expiry, cvv } = req.body.card;
    const [expmm, , expyy] = expiry.split('/');


    try {
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

      return {status:200, data: authoriseOrder.data};
    } catch (error) {
      return {status:500, error: error.response?.data?.error || error.message || 'Unknown error'}
    }
  }


 
  async function orderAuthorizeWithoutCardl(req) {
    const orderId = req.body.id;
    const accessToken = await getPayPalAccessTokenl();
 
    try {
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
     return {status:200, data: authoriseOrderWithoutCard.data};
    } catch (error) {
      return {status:500, error:error.response?.data?.error || error.message || 'Not able to authorise'};
    }
  }

   const orderAuthorizeWithoutCard = async (req, res) => {
    try {
      const ordAutWithoutCard = await orderAuthorizeWithoutCardl(req);

      if (ordAutWithoutCard?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: ordAutWithoutCard?.error });
      }
      // update payments with authorizationId
      // call the method and check for the status
      const postAuth = await postPaymentAuthorizationsWithoutCard(ordAutWithoutCard.data);
      if (postAuth?.status !== 200) {
      
      if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postAuth?.error });
      }
      
      return res.status(200).json({success:true, data:postAuth.data});
    } catch (error) {
      return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 'Not able to authorise'});
    }
  };

  // US Phone number validation
  function isValidUSPhoneNumber(number) {
    const regex = /^(?:\+1\s?)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})$/;
    return regex.test(number);
  }

  const postBidsAndPay = async (req, res) => {
    const accessToken = await getPayPalAccessTokenl();
    
    try {
      const isValidCard = await cardValidation(req);
      if (isValidCard?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: isValidCard?.error });
      }


      const isValidPhoneNumber = isValidUSPhoneNumber(req.body.phone);
      if (isValidPhoneNumber !== true)
        return res.status(500).json({ success: false, error: 'Invalid PhoneNumber' });

      const userExists = await Users.findOne({ email: req.body.email });
      if (!userExists) {
        return res.status(500).json({ success: false, error: 'Invalid email' });
      }

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return res.status(500).json({ success: false, error: 'Invalid listingId' });
      }

      const createOrdersC = await createOrderl(req);

      if (createOrdersC?.success === false) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: createOrdersC?.error });
      }
      const postBidsResponse = await postBidsloc(req,createOrdersC.data);
      if (postBidsResponse?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postBidsResponse?.error });
      }

      const postPaymnts = await postPayments(
        req,
        createOrdersC.data,
        postBidsResponse?.data,
      );

      if (postPaymnts?.success === false) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postPaymnts?.error });
      }

      return res.status(201).json({ success: true, data: postPaymnts?.data });

    } catch (error) {
      return res.status(500).json({success:false, error :error.response?.data?.error || error.message || 'Unknown error'});
    }
  };

  const postBidsAndPayWithoutCard = async (req, res) => {
  
    try {
      
      
      const userExists = await Users.findOne({ email: req.body.email });
      if (!userExists) {
        return res.status(400).json({ success: false, error: 'Invalid email' });
      }

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return res.status(400).json({ success: false, error: 'Invalid listingId' });
      }
      const createOrdersWithoutCardC = await createOrderWithoutCardl(req);
      
  
      if (createOrdersWithoutCardC?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: createOrdersWithoutCardC?.error });
       }
      const postBidsResponse = await postBidsloc(req, createOrdersWithoutCardC.data);
      if (postBidsResponse?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postBidsResponse?.error });
      }
      
      const postPaymnts = await postPaymentsWithoutCard(
        req,        
        createOrdersWithoutCardC.data,
        postBidsResponse?.data,
      );
      if (postPaymnts?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postPaymnts?.error });
      }

      return res.status(200).json({ success: true, data: postPaymnts?.data });

      } catch (error) {
        return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 'Unknown error'});
    }
  };

  const updateOrderLocal = async  (req) => {
    if (!ready ) throw new Error('Bids Controllere Init not ready!');

    const accessToken = await getPayPalAccessTokenl();
    const paypalRequestId = `request-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const { bidPrice,listingId,startDate, endDate,paypalOrderId, email } = req.body || req;
    const userExists = await Users.findOne({ email });

    if (!userExists) {
      return { status: 400, error: 'Invalid email' };
    }
    const bidExists = paypalOrderId ? await Bids.findOne({ paypalOrderId})
                              : await Bids.findOne({ listingId, 
                                           startDate,
                                           endDate
                                           // userId needed
                                            });
    
    if (!bidExists) {
      return { status: 400, error: 'Invalid matching details' };
    }
    const lastBid = bidExists.biddingHistory[bidExists.biddingHistory.length - 1];
    const firstBid = bidExists.biddingHistory[0];
    
    const oldBidPrice = firstBid.bidPrice;
    
    // First, find the index of the correct purchase_unit

    const rentalPeriod = await getRentalPeriod(bidExists.startDate, 
                                         bidExists.endDate);
    
    const paymentExists = await Payments.findOne({
      paypalOrderId: {
        $in: [bidExists.paypalOrderId],
      },
    });
    
    
    try {
      const paypalOrder = await axios.get(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
     
      const units = paypalOrder.data.purchase_units;
      
      // const referenceIndex = units.findIndex((u) => u.reference_id === '$[oldBidPrice.toString()}');
      const referenceIndex = units.findIndex((u) => u.reference_id === oldBidPrice.toString());
      
      
     
      const updateOrd = await axios.patch(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        [
          {
            op:  "replace",
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

      const afterPatchPaypalOrder = await axios.get(
        `${process.env.BASE_URL}/v2/checkout/orders/${paymentExists.paypalOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
     
      return { status: 200, data: afterPatchPaypalOrder.data }; 
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'UpdateOrder Error' };
    }
  }

  const updateOrder = async (req, res) => {
    try {
      const updOrd = await updateOrderLocal(req);
if (updOrd?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: updOrd?.error });
      }

      const savedBidHistory = await addBidToHistory(Bids, req.body.listingId, req.body.bidPrice,req.body.paypalOrderId);
      if (savedBidHistory?.status !== 200) {
        return res.status(500).json({success:false,  error: savedBidHistory?.error });
      }

      const postAuth = await postPaymentUpdateOrderWithoutCard(updOrd.data);
      if (postAuth?.status !== 200) {
      
      if (res.headersSent) return;
        return res.status(500).json({ success: false, error: postAuth?.error });
      }
      

      return res.status(200).json({success:true, data:postAuth.data});
    } catch (error) {
      return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 'Update Order Error'});
    }
  };

  const  orderCheckoutNowLocal = async (req) => {
   
    if (!ready ) throw new Error('Bids Controllere Init not ready!');
    const paypalOrderId = req?.paypalOrderId ?? req?.body?.paypalOrderId;

    const outUrl = req?.hrefLink ?? req?.body?.hrefLink;
    
   
   try
    {
    const bidExists = await Bids.findOne({ paypalOrderId });
    if (!bidExists) {
      return { status: 400, error: 'Invalid orderId' };
    }
    
    const userExists = await Users.findOne({ _id: bidExists.userId });
    if (!userExists) {
      return { status: 400, error: 'Invalid email' };
    }
      const emailPaymentApprovalBody = `   
    <p> Hi ${userExists.name} </p>

<p> Thank you for your order!</p>

<p> To complete your payment securely through PayPal, please click the link below:</p>

<p>👉 Complete Your Payment <a href="${outUrl}">Click here to approve payment</a> </p>

<p> This will open the PayPal checkout page where you can review and approve your payment.</p>

<p> If you have any questions or run into any issues, feel free to reply to this email and we’ll be happy to help.</p>

<p>Best regards,</p>
<p>One Community global</p>`;


  await emailSender(
    userExists.email, // toEmailAddress
    'Approve Your Payment via PayPal', // subject
    emailPaymentApprovalBody, // message
    null, // attachments
    null, //  cc
    'onecommunityglobal@gmail.com', // reply to
  );
      return { status: 200, data:  'Email sent successfully.' };
   
     } catch (error) {
     
      return { status: 500, error: error.response?.data?.error || error.message || 
'Error in sending the Email' }; 
    } 
  }
  const orderCheckoutNow = async (req, res) => {
      
    try {
      const ordChkoutNow = await orderCheckoutNowLocal(req);

      if (ordChkoutNow?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: ordChkoutNow?.error });
      }
  const chkoutNowData = await postPaymentCheckoutNowWithoutCard(req);
  
      if (chkoutNowData?.status !== 200) {
        if (res.headersSent) return;
        return res.status(500).json({ success: false, error: chkoutNowData?.error });
      }
  
      return res.status(200).json({ success: true, data: ordChkoutNow.data});
    } catch (error) {
      return res.status(500).json({success:false, error:error.response?.data?.error || error.message || 
'Error in sending the Email'});
    }
    
  };
    const getOrderDetails = async (req, res) => {
          const accessToken = await getPayPalAccessTokenl();
          const paypalOrderId = req.params.orderId;
 try {
  const orderDet = await axios.get(
          `${process.env.BASE_URL}/v2/checkout/orders/${paypalOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
        },
      );
       return res.status(200).json({ success: true, data: orderDet.data });
     
    } catch (error) {

      return res.status(500).json({success:false, error: error.response?.data?.error || error.message || 'Order Details error'});
    
    }
  

  };



  function init() {
    ready = true;
  }
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
    getOrderDetails, 
    init
  };
};

module.exports = bidsController;

