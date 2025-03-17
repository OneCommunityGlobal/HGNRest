const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const userBidController = (Bid, User) => {
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

      const propertyExists = await bidoverview_Listing.exists({ _id: propertyId });

      if (!propertyExists) {
        return res.status(404).json({ message: 'Property not found' });
      }
      const user = await User.findOne({ name, email }).select('_id');
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please register first.' });
      }

      const newBid = new Bid({
        user_id: user._id,
        property_id: propertyId,
        start_date: startDate,
        bid_amount: bidAmount,
      });
      await newBid.save();
      res.status(201).json({ message: 'Bid placed successfully', bid: newBid });
    }
    catch (error) {
      console.error('Error placing bid:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
  return placeBid;
}

module.exports = userBidController;