const mongoose = require('mongoose');

const listingAvailablityController = (Availability) => {
  // GET /availability?listingId=...
  const getAvailability = async (req, res) => {
    try {
      const { listingId } = req.query;
      if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
        return res.status(400).json({ error: 'Valid listingId is required' });
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

  // GET /availability/:id
  const getAvailabilityById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id' });
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

  // POST /availability
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

  // PUT /availability/:id
  const updateAvailability = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id' });
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

  // DELETE /availability/:id
  const deleteAvailability = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid availability id' });
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
    getAvailability,
    getAvailabilityById,
    createAvailability,
    updateAvailability,
    deleteAvailability,
  };
};

module.exports = listingAvailablityController;