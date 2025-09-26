const mongoose = require('mongoose');

const Listings = require('../../models/lbdashboard/listings');

const bidsDeadlineController = function (BidDeadlines) {
  const parseDate = (dateStr) => {
    const [month, day, year] = dateStr.split('/'); // Extract parts
    return new Date(`${month}-${day}-${year}`); // Convert to YYYY-MM-DD format
  };

  const postBidDeadlinesloc = async (req) => {
    try {
      const { listingId } = req.body;
      const inStartDate = parseDate(req.body.startDate);
      const inEndDate = parseDate(req.body.endDate);


      if (!listingId) {
        return { status: 400, error: 'listingId cannot be empty' };
        
      }

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return { status: 400, error: 'Invalid listingId' };
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
      const newBidDeadlinesData = { ...req.body };
      const newBidDeadlines = new BidDeadlines(newBidDeadlinesData);
      const savedBidDeadlines = await newBidDeadlines.save();
      return { status: 200, data: savedBidDeadlines };
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || "Unknown error"};
    }
  };

  const postBidDeadlines = async (req, res) => {
    try {
      const savedBidDeadlines = await postBidDeadlinesloc(req);
      if (savedBidDeadlines.status !== 200) {
        return res.status(500).json({ success: false, error: savedBidDeadlines.error });
      }
      return res.status(200).json({ success: true, data: savedBidDeadlines.data });
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  };

  const getBidDeadlines = async (req, res) => {
    try {
      const results = await BidDeadlines.find({ isActive: { $ne: false } })
        .select('listingId startDate endDate biddingHistory -_id');
        if (!results) {
        return res.status(404).json({ error: 'Listing not found' });
        }
        res.status(200).send(results);
    }
          catch(error)  {
          console.error('Database query failed:', error); // Better logging
          res.status(500).send({ error:error.response?.data?.error || error.message || 'Unknown error' });
        };
    
  };
  const addBidToHistory = async (modl, listingId, amount, paypalOrderId = null) => {
   
    if (!modl  || amount == null) {
      throw new Error('model  and amount are required.');
    }
if (!paypalOrderId && !listingId) {
  throw new Error('Either paypalOrderId or listingId is required.');
}

    const bidEntry = {
      bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
      createdDatetime: new Date(),
    };
    // return modl.updateOne({ listingId }, { $push: { biddingHistory: bidEntry } });

    const bidHist = paypalOrderId ? await  modl.updateOne({ paypalOrderId }, { $push: { biddingHistory: bidEntry } }) :
    await  modl.updateOne({ listingId }, { $push: { biddingHistory: bidEntry } });
    
    return {status:200, data:{ matchedCount: bidHist.n,    modifiedCount: bidHist.nModified} };
    
   };

  return {
    getBidDeadlines,
    postBidDeadlines,
    addBidToHistory,
  };
};

module.exports = bidsDeadlineController;
