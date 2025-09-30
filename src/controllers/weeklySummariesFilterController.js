const WeeklySummariesFilter = require('../models/weeklySummariesFilter');
const UserProfile = require('../models/userProfile');

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

      if (!filter.filterName) {
        return res.status(400).json({ error: 'Filter name is required' });
      }

      if (filter.filterName.length > 7) {
        return res.status(400).json({ error: 'Filter name must not exceed 7 characters' });
      }
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

  updateFilterWithIndividualCodeChange: async (req, res) => {
    const { oldTeamCode, newTeamCode, userId } = req.body;

    if (!oldTeamCode || !newTeamCode || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      // Remove member that is selected extra members in filter that have newTeamCode
      const filters = await WeeklySummariesFilter.find({
        selectedExtraMembers: userId,
        selectedCodes: newTeamCode,
      });

      await Promise.all(
        filters.map(async (filter) => {
          filter.selectedExtraMembers = filter.selectedExtraMembers.filter(
            (memberId) => memberId !== userId,
          );
          await filter.save();
        }),
      );

      res.json({
        message: 'Filters updated successfully',
        updatedCount: filters.length,
      });
    } catch (err) {
      console.error('Update failed:', err);
      res.status(500).json({ error: 'Update failed', details: err.message });
    }
  },

  updateFiltersWithReplacedTeamCode: async (req, res) => {
    const { oldTeamCodes, newTeamCode } = req.body;

    if (!oldTeamCodes || !newTeamCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sanitizedOldTeamCodes = oldTeamCodes.map((code) => String(code).trim());
    sanitizedOldTeamCodes.push(String(newTeamCode).trim());

    try {
      // 1. Find all users with old team codes
      const users = await UserProfile.find(
        { teamCode: { $in: sanitizedOldTeamCodes } },
        { _id: 1 },
      );

      const notExtraMembers = users.map((u) => u._id.toString());

      // 2. Find all filters to update
      const filters = await WeeklySummariesFilter.find({
        selectedCodes: { $in: sanitizedOldTeamCodes },
      });

      // 3. Update filters in parallel
      await Promise.all(
        filters.map(async (filter) => {
          // remove old team codes
          filter.selectedCodes = filter.selectedCodes.filter(
            (code) => !sanitizedOldTeamCodes.includes(code),
          );

          // remove old extra members
          filter.selectedExtraMembers = filter.selectedExtraMembers.filter(
            (memberId) => !notExtraMembers.includes(memberId.toString()),
          );

          // add new team code if not already there
          if (!filter.selectedCodes.includes(newTeamCode)) {
            filter.selectedCodes.push(newTeamCode);
          }

          await filter.save();
        }),
      );

      res.json({
        message: 'Filters updated successfully',
        updatedCount: filters.length,
      });
    } catch (err) {
      console.error('Update failed:', err);
      res.status(500).json({ error: 'Update failed', details: err.message });
    }
  },
});
