const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const userBidNotificationController = (Bid, List, User, Notification) => {
  const placeBid = async (req, res) => {
    try {
      await Promise.all([
        body('name').notEmpty().withMessage('Name is required').run(req),
        body('email').isEmail().withMessage('Valid email is required').run(req),
        body('startDate').isISO8601().toDate().withMessage('Valid start date is required').run(req),
        body('bidAmount').isFloat({ min: 0 }).withMessage('Bid amount must be a positive number').run(req),
      ]);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, startDate, bidAmount } = req.body;
      const propertyId = req.params.id;

      const propertyExists = await List.exists({ _id: propertyId });


      const user = await User.findOne({ name, email }).select('_id');
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please register first.' });
      }

      if (!propertyExists) {

        const notification = new Notification({
          user_id: user._id,
          message: "Property not found",
          timestamp: new Date().toISOString().split('T')[0],
        });

        await notification.save();
        return res.status(404).json({ message: 'Property not found' });
      }
      const newBid = new Bid({
        user_id: user._id,
        property_id: propertyId,
        start_date: startDate,
        bid_amount: bidAmount,
      });
      await newBid.save();

      const successNotification = new Notification({
        user_id: user._id,
        message: `Bid placed on property ${propertyId} for amount $${bidAmount}`,
        timestamp: new Date().toISOString().split('T')[0],
      });

      await successNotification.save();

      res.status(201).json({ message: 'Bid placed successfully', bid: newBid });
    }
    catch (error) {
      console.error('Error placing bid:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  return { placeBid };
}

module.exports = userBidNotificationController;