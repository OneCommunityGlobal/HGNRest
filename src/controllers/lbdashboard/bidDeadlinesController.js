const mongoose = require('mongoose');

// const BidDeadlines = require('../../models/lbdashboard/bidDeadline');
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

      console.log(req.body);

      if (!listingId) {
        return { status: 400, error: 'listingId cannot be empty' };
      }

      const listingsExists = await Listings.findOne({ _id: req.body.listingId });
      if (!listingsExists) {
        return { status: 400, error: 'Invalid listingId' };
      }
      console.log(listingsExists);

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
      console.log(newBidDeadlines);
      const savedBidDeadlines = await newBidDeadlines.save();
      console.log(savedBidDeadlines);
      return { status: 200, data: savedBidDeadlines };
    } catch (error) {
      return { status: 500, error: error.message };
    }
  };

  const postBidDeadlines = async (req, res) => {
    try {
      const savedBidDeadlines = await postBidDeadlinesloc(req);
      console.log('savedBidDeadlines');

      console.log(savedBidDeadlines);
      if (savedBidDeadlines.status !== 200) {
        return res.status(500).json({ success: false, error: savedBidDeadlines.error });
      }
      console.log(savedBidDeadlines);
      res.status(200).json({ success: true, data: savedBidDeadlines.data });
    } catch (error) {
      res.status(500).json({ success: false, error });
    }
  };

  const getBidDeadlines = async (req, res) => {
    console.log('getBidDeadlines');
    try {
      console.log('inside getBidDeadlines');
      BidDeadlines.find({ isActive: { $ne: false } })
        .select('listingId startDate endDate biddingHistory -_id')
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
  const addBidToHistory = async (modl, listingId, amount) => {
    console.log('addBidToHistory');
    console.log(modl);
    console.log(listingId);
    console.log(amount);

    if (!modl || !listingId || amount == null) {
      throw new Error('model, listingId and amount are required.');
    }

    const bidEntry = {
      bidPrice: mongoose.Types.Decimal128.fromString(amount.toString()),
      createdDatetime: new Date(),
    };
    return modl.updateOne({ listingId }, { $push: { biddingHistory: bidEntry } });

    //  return BidDeadlines.updateOne({ listingId }, { $push: { biddingHistory: bidEntry } });
  };

  return {
    getBidDeadlines,
    postBidDeadlines,
    addBidToHistory,
  };
};

module.exports = bidsDeadlineController;
