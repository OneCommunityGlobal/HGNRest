const mongoose = require('mongoose');
const Listings = require('../../models/lbdashboard/listings');
const Village = require('../../models/lbdashboard/villages');
const { summarizeWinningVsAverageBids } = require('./winningVsAverageBidHelpers');

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
      const { listingId: reqListingId, isActive, isClosed } = req.body;
      const newBidDeadlines = new BidDeadlines({
        listingId: reqListingId,
        startDate: inStartDate,
        endDate: inEndDate,
        isActive,
        isClosed,
      });
      const savedBidDeadlines = await newBidDeadlines.save();
      return { status: 200, data: savedBidDeadlines };
    } catch (error) {
      return {
        status: 500,
        error: error.response?.data?.error || error.message || 'Unknown error',
      };
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
      const results = await BidDeadlines.find({ isActive: { $ne: false } }).select(
        'listingId startDate endDate biddingHistory -_id',
      );
      if (!results) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      res.status(200).send(results);
    } catch (error) {
      console.error('Database query failed:', error); // Better logging
      res
        .status(500)
        .send({ error: error.response?.data?.error || error.message || 'Unknown error' });
    }
  };
  const getWinningVsAverageBids = async (req, res) => {
    try {
      const { startDate, endDate, category = 'property', ids, limit } = req.query;

      if (!['property', 'village'].includes(category)) {
        return res.status(400).json({ error: 'category must be "property" or "village"' });
      }

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
        return res.status(400).json({ error: 'Invalid startDate or endDate' });
      }
      if (start && end && start > end) {
        return res.status(400).json({ error: 'startDate must be before endDate' });
      }

      const parsedLimit = limit === undefined ? 10 : parseInt(limit, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return res.status(400).json({ error: 'limit must be between 1 and 50' });
      }

      const idList = ids
        ? String(ids)
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      if (idList.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: 'ids must be valid ObjectIds' });
      }

      const deadlines = await BidDeadlines.find({ isActive: { $ne: false } })
        .select('listingId endDate biddingHistory isClosed')
        .lean();

      const listingIds = [
        ...new Set(
          deadlines
            .map((d) => d.listingId)
            .filter(Boolean)
            .map(String),
        ),
      ];
      const listings = await Listings.find({ _id: { $in: listingIds } })
        .select('title village')
        .lean();

      const villageIds = [
        ...new Set(
          listings
            .map((l) => l.village)
            .filter(Boolean)
            .map(String),
        ),
      ];
      const villages = await Village.find({ _id: { $in: villageIds } })
        .select('name')
        .lean();

      const result = summarizeWinningVsAverageBids({
        deadlines,
        listings,
        villages,
        start,
        end,
        category,
        ids: idList,
        limit: parsedLimit,
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Failed to build winning vs average bid stats:', error);
      return res.status(500).json({ error: error.message || 'Unknown error' });
    }
  };

  const addBidToHistory = async (modl, listingId, amount, paypalOrderId = null) => {
    if (!modl || amount == null) {
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

    const bidHist = paypalOrderId
      ? await modl.updateOne({ paypalOrderId }, { $push: { biddingHistory: bidEntry } })
      : await modl.updateOne({ listingId }, { $push: { biddingHistory: bidEntry } });

    return { status: 200, data: { matchedCount: bidHist.n, modifiedCount: bidHist.nModified } };
  };

  return {
    getBidDeadlines,
    getWinningVsAverageBids,
    postBidDeadlines,
    addBidToHistory,
  };
};

module.exports = bidsDeadlineController;
