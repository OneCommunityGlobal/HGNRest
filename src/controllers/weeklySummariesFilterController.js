const WeeklySummariesFilter = require('../models/weeklySummariesFilter');

module.exports = () => ({
  getFilters: async (req, res) => {
    try {
      const filters = await WeeklySummariesFilter.find().sort({ filterName: -1 });
      res.json(filters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createFilter: async (req, res) => {
    try {
      const filter = new WeeklySummariesFilter(req.body);
      const savedFilter = await filter.save();
      res.status(201).json(savedFilter);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  getFilterById: async (req, res) => {
    try {
      const filter = await WeeklySummariesFilter.findById(req.params.id);
      if (!filter) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json(filter);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  replaceFilter: async (req, res) => {
    try {
      const updatedFilter = await WeeklySummariesFilter.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!updatedFilter) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json(updatedFilter);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  updateFilter: async (req, res) => {
    try {
      const updatedFilter = await WeeklySummariesFilter.findByIdAndUpdate(
        req.params.id,
        { $set: req.body }, // only update provided fields
        { new: true, runValidators: true },
      );
      if (!updatedFilter) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json(updatedFilter);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  deleteFilter: async (req, res) => {
    try {
      const deleted = await WeeklySummariesFilter.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Filter not found' });
      }
      res.json({ message: 'Filter deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});
