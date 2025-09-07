const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const biddingOverviewController = (Bid, List, User, Notification) => {
  /**
   * API 1 - Get property details with current highest bid (bid overview of a particular listing)
   */
  const getPropertyDetails = async (req, res) => {
    try {
      const { listingId } = req.params;
      const property = await List.findById(mongoose.Types.ObjectId(listingId)).select(
        'title description price images amenities',
      );
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      // Highest bid from db or else 0
      const highestBid = await Bid.findOne({ listing_id: listingId })
        .sort({ bid_amount: -1 })
        .select('bid_amount');

      res.status(200).json({
        property,
        currentBid: highestBid ? highestBid.bid_amount : 0,
      });
    } catch (error) {
      console.error('Error in fetching property:', error);
      res.status(500).json({
        message: 'Error occurred while fetching property details',
        error: error.message,
      });
    }
  };

  /**
   * API 2 - Place a bid
   */
  const placeBid = async (req, res) => {
    try {
      await Promise.all([
        body('userId').notEmpty().withMessage('User ID is required').run(req),
        body('bidAmount')
          .isFloat({ min: 0 })
          .withMessage('Bid amount must be a positive number')
          .run(req),
      ]);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, bidAmount } = req.body;
      const listingId = req.params.id;

      const property = await List.findById(listingId);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      // check user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // check current highest bid
      const currentHighest = await Bid.findOne({ listing_id: listingId }).sort({ bid_amount: -1 });

      let bidStatus = 'accepted';
      let notificationMessage = '';

      if (bidAmount < property.price) {
        // lower than base price
        bidStatus = 'rejected';
        notificationMessage = `Your bid of $${bidAmount} was rejected. Minimum is $${property.price}`;
      } else if (!currentHighest || bidAmount > currentHighest.bid_amount) {
        // this user is now the winner
        bidStatus = 'won';
        notificationMessage = `You are now the highest bidder for "${property.title}" with $${bidAmount}`;

        // update old highest bidder (if exists)
        if (currentHighest) {
          await Bid.findByIdAndUpdate(currentHighest._id, {
            bid_status: 'accepted',
          });

          // notify old bidder they were outbid
          const outbidNotification = new Notification({
            user_id: currentHighest.user_id,
            listing_id: listingId,
            bid_id: currentHighest._id,
            message: `You were outbid on "${property.title}". Another user placed a higher bid.`,
            timestamp: new Date(),
          });
          await outbidNotification.save();
        }
      } else {
        // bid is >= base price but not higher than current highest
        bidStatus = 'accepted';
        notificationMessage = `Your bid of $${bidAmount} was accepted, but another bidder is currently higher.`;
      }

      // Save new bid
      const newBid = new Bid({
        user_id: user._id,
        listing_id: listingId,
        bid_amount: bidAmount,
        bid_status: bidStatus,
      });
      await newBid.save();

      // Save notification for this bidder
      const notification = new Notification({
        user_id: user._id,
        listing_id: listingId,
        bid_id: newBid._id,
        message: notificationMessage,
        timestamp: new Date(),
      });
      await notification.save();

      res.status(201).json({ message: 'Bid placed successfully', bid: newBid });
    } catch (error) {
      console.error('Error placing bid:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * API 3 - Get notifications for a user
   */
  const getNotifications = async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await Notification.find({ user_id: userId }).sort({
        timestamp: -1,
      });

      res.status(200).json({ notifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  return {
    getPropertyDetails,
    placeBid,
    getNotifications,
  };
};

module.exports = biddingOverviewController;
