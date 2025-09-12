const Listing = require('../../models/lbdashboard/listings');
const Bid = require('../../models/lbdashboard/bidoverview/Bid');
const Notification = require('../../models/lbdashboard/bidoverview/Notification');

/**
 *
 * @param {*} req
 * @param {*} res
 *
 * API to get bid overview data which include data from listings and bid collection
 * to be displayed on page
 */
const getBidOverview = async (req, res) => {
  try {
    // fetch listing detail
    const listingId = req.params.id;
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    const listingDetail = {
      id: listing._id,
      title: listing.title,
      description: listing.description,
      image: listing.image,
      amenities: listing.amenities,
      availableFrom: listing.availableFrom,
      availableTo: listing.availableTo,
      bidAmount: listing.price || 0,
    };
    res.status(200).json({ listingDetail });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 *
 * @param {*} req
 * @param {*} res
 *
 * API to place bid on a listing
 */
const placeBid = async (req, res) => {
  try {
    const {
      userId,
      propertyId,
      bid_amount: bidAmount,
      start_date: startDate,
      end_date: endDate,
    } = req.body;
    const bidValue = Number(bidAmount);

    // check listing's existence
    const listing = await Listing.findById(propertyId);
    if (!listing) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // validating bid amount in comparison to listing price
    if (bidValue <= listing.price) {
      return res.status(400).json({
        message: `Your bid must be higher than the listed price (${listing.price}).`,
      });
    }
    const highestBid = await Bid.findOne({
      property_id: propertyId,
    }).sort({ bid_amount: -1 });

    // saving new bid
    const newBid = new Bid({
      user_id: userId,
      property_id: propertyId,
      bid_amount: bidValue,
      start_date: startDate,
      end_date: endDate,
    });
    await newBid.save();

    // first notifaction - bid placed
    await Notification.create({
      user_id: userId,
      property_id: propertyId,
      message: `You have successfully placed a bid of ${bidValue} on ${listing.title}.`,
    });

    // second notification - highest bid
    if (!highestBid || bidValue > highestBid.bid_amount) {
      await Notification.create({
        user_id: userId,
        property_id: propertyId,
        message: `Congratulations! Your bid of ${bidValue} is currently the highest for ${listing.title}.`,
      });

      // third notification - outbid
      if (highestBid && highestBid.user_id.toString() !== userId.toString()) {
        await Notification.create({
          user_id: highestBid.user_id,
          property_id: propertyId,
          message: `You have been outbid on ${listing.title}. Current highest bid is ${bidValue}.`,
        });
      }
    }

    res.status(201).json({
      message: 'Bid placed successfully',
      bid: newBid,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getBidOverview,
  placeBid,
};
