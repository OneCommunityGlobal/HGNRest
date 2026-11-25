const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const userBidNotificationController = (Bid, List, User, Notification) => {
  const placeBid = async (req, res) => {
    try {
      await Promise.all([
        body('startDate').isISO8601().toDate().withMessage('Valid start date is required').run(req),
        body('endDate').isISO8601().toDate().withMessage('Valid end date is required').run(req),
        body('bidAmount')
          .isFloat({ gt: 0 })
          .withMessage('Bid amount must be greater than 0')
          .run(req),
      ]);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, startDate, endDate } = req.body;
      const bidAmount = Number(req.body.bidAmount);
      const propertyId = req.params.id;
      const userId = req.body.requestor?.requestorId; // set by auth middleware

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({ message: 'Invalid property id' });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }

      const listing = await List.findById(propertyId).select('currentPrice');
      if (!listing) {
        return res.status(404).json({ message: 'Property not found' });
      }
      if (bidAmount <= listing.currentPrice) {
        return res
          .status(400)
          .json({ message: `Bid must be higher than $${listing.currentPrice}` });
      }

      const newBid = await Bid.create({
        user_id: userId,
        property_id: propertyId,
        name,
        start_date: startDate,
        end_date: endDate,
        bid_amount: bidAmount,
      });

      // only raises the price if it's still lower, so two bids at the same time can't lower it
      await List.updateOne(
        { _id: propertyId, currentPrice: { $lt: bidAmount } },
        { $set: { currentPrice: bidAmount } },
      );

      await Notification.create({
        user_id: userId,
        message: `Bid placed on property ${propertyId} for amount $${bidAmount}`,
        timestamp: new Date().toISOString().split('T')[0],
      });

      return res.status(201).json({ message: 'Bid placed successfully', bid: newBid });
    } catch (error) {
      console.error('Error placing bid:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  return { placeBid };
};

module.exports = userBidNotificationController;
