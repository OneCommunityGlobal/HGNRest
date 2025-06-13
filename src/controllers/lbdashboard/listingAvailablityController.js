const mongoose = require('mongoose');

const listingAvailablityController = (Availability) => {
  const getAvailabilities = async (req, res) => {
    try {
      const listingId = req.headers['listingid'];
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required in header' });
      }
      const availability = await Availability.findOne({ listingId });
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const getAvailabilityById = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id in header' });
      }
      const availability = await Availability.findById(id);
      if (!availability) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const createAvailability = async (req, res) => {
    try {
      const data = req.body;
      if (!data.listingId || !mongoose.Types.ObjectId.isValid(data.listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required' });
      }
      let availability = await Availability.findOne({ listingId: data.listingId });
      if (availability) {
        return res.status(409).json({ error: 'Availability already exists for this listing' });
      }
      availability = new Availability(data);
      await availability.save();
      res.status(201).json({ status: 201, data: availability });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const updateAvailability = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id in header' });
      }
      const updated = await Availability.findByIdAndUpdate(id, req.body, { new: true });
      if (!updated) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, data: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  const deleteAvailability = async (req, res) => {
    try {
      const id = req.headers['id'];
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id in header' });
      }
      const deleted = await Availability.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Availability not found' });
      }
      res.json({ status: 200, message: 'Availability deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  return {
    getAvailabilities,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability,
  };
};

module.exports = listingAvailablityController;