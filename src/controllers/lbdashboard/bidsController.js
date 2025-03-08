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
  const BASE_URL = 'https://api-m.sandbox.paypal.com'; // Use live URL in production

  //  Generate PayPal Access Token
  async function getPayPalAccessToken() {
    try {
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString('base64');

      const response = await axios.post(
        `${BASE_URL}/v1/oauth2/token`,
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
  /*
async function paypalProcess() {
}
paypalProcess();
*/
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

  const getPaymentCardToken = async (req, res) => {
    const { cardNumber, expMonth, expYear, cvv, amt } = req.body.card;
    console.log(cardNumber, expMonth, expYear, cvv, amt);
    console.log('before calling getPayPal');
    const accessToken = await getPayPalAccessToken();
    console.log(accessToken);
    //  Process Direct Card Payment
    /* try {
      const paymentData = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal',
        },
        transactions: [
          {
            amount: {
              total: '5000',
              currency: 'USD',
            },
            description: 'Test PayPal Payment',
          },
        ],
        redirect_urls: {
          return_url: 'https://example.com/return',
          cancel_url: 'https://example.com/cancel',
        },
      };

      // Call PayPal API to process payment
      const response = await axios.post(`${BASE_URL}/v1/payments/payment`, paymentData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('PayPal Payment Error:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.message });
    }
*/
    try {
      const paymentGetCardToken = {
        intent: 'sale',
        payment_source: {
          card: {
            number: cardNumber,
            expiry: '2027-02',
            security_code: '563',
            name: 'Some Name',
            billing_address: {
              address_line_1: '21 N First Street',
              address_line_2: '1.3.160',
              admin_area_1: 'CA',
              admin_area_2: 'San Jose',
              postal_code: '95131',
              country_code: 'US',
            },
          },
        },
      };

      // Call PayPal API to process payment tokens
      const response = await axios.post(`${BASE_URL}/v3/vault/setup-tokens`, paymentGetCardToken, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('PayPal Payment Token Error:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  return { getBids, postBids, getPaymentCardToken };
};

module.exports = bidsController;
