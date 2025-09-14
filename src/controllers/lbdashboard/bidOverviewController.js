const Listing = require('../../models/lbdashboard/listings');
const Bid = require('../../models/lbdashboard/bidoverview/Bid');
const Notification = require('../../models/lbdashboard/bidoverview/Notification');
const Village = require('../../models/lbdashboard/villages');

/**
 * API to get bid overview data
 */
const getBidOverview = async (req, res) => {
  try {
    const listingId = req.params.id;
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    // fetching village amenities
    let villageAmenities = [];
    if (listing.village) {
      const village = await Village.findOne({ name: listing.village });
      if (village && Array.isArray(village.amenities)) {
        villageAmenities = village.amenities;
      }
    }

    const listingDetail = {
      id: listing._id,
      title: listing.title,
      description: listing.description,
      images: listing.images,
      unitAmenities: listing.amenities,
      villageAmenities,
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
 * API to place bid on a listing
 */
const placeBid = async (req, res) => {
  try {
    const {
      user_id: userId,
      property_id: propertyId,
      bid_amount: bidAmount,
      start_date: startDate,
      end_date: endDate,
    } = req.body;

    const bidValue = Number(bidAmount);

    // check listing existence
    const listing = await Listing.findById(propertyId);
    if (!listing) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // validate bid amount
    if (bidValue <= listing.price) {
      return res.status(400).json({
        message: `Your bid must be higher than the listed price (${listing.price}).`,
      });
    }

    const highestBid = await Bid.findOne({ property_id: propertyId }).sort({ bid_amount: -1 });

    // save new bid
    const newBid = new Bid({
      user_id: userId,
      property_id: propertyId,
      bid_amount: bidValue,
      start_date: startDate,
      end_date: endDate,
    });
    await newBid.save();

    const notifications = [];

    // notification: bid placed
    const bidPlacedNotification = await Notification.create({
      user_id: userId,
      property_id: propertyId,
      message: `You have successfully placed a bid of ${bidValue} on ${listing.title}.`,
    });
    notifications.push(bidPlacedNotification);

    // notification: highest bid
    if (!highestBid || bidValue > highestBid.bid_amount) {
      const highestBidNotification = await Notification.create({
        user_id: userId,
        property_id: propertyId,
        message: `Congratulations! Your bid of ${bidValue} is currently the highest for ${listing.title}.`,
      });
      notifications.push(highestBidNotification);

      // notification: outbid
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
      notifications,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getBidOverview,
  placeBid,
};
