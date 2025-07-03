const mongoose = require('mongoose');
const SavedFilter = require('../models/savedFilter');
const helper = require('../utilities/permissions');

const savedFilterController = function () {
  /**
   * Get all saved filters
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const getAllSavedFilters = async function (req, res) {
    try {
      // Check if user has permission to see saved filters
      if (
        !(await helper.hasPermission(req.body.requestor, 'seeSavedFilters')) &&
        !(await helper.hasPermission(req.body.requestor, 'createSavedFilters')) &&
        !(await helper.hasPermission(req.body.requestor, 'deleteSavedFilters'))
      ) {
        res.status(403).send('You are not authorized to view saved filters.');
        return;
      }

      const filters = await SavedFilter.find({})
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.status(200).send(filters);
    } catch (error) {
      res.status(500).send(`Internal Error: ${error.message}`);
    }
  };

  /**
   * Create a new saved filter
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const createSavedFilter = async function (req, res) {
    try {
      // Check if user has permission to create saved filters
      if (!(await helper.hasPermission(req.body.requestor, 'createSavedFilters'))) {
        res.status(403).send('You are not authorized to create saved filters.');
        return;
      }

      const { name, filterConfig } = req.body;

      // Validate filter name length
      if (!name || name.trim().length > 5) {
        res.status(400).send('Filter name must be 5 characters or less.');
        return;
      }

      // Check if filter name already exists
      const existingFilter = await SavedFilter.findOne({ name: name.trim() });
      if (existingFilter) {
        res.status(400).send('Filter name already exists.');
        return;
      }

      const newFilter = new SavedFilter({
        name: name.trim(),
        filterConfig,
        createdBy: req.body.requestor._id,
      });

      const savedFilter = await newFilter.save();
      const populatedFilter = await SavedFilter.findById(savedFilter._id).populate(
        'createdBy',
        'firstName lastName',
      );

      res.status(201).send(populatedFilter);
    } catch (error) {
      if (error.code === 11000) {
        res.status(400).send('Filter name already exists.');
      } else {
        res.status(500).send(`Internal Error: ${error.message}`);
      }
    }
  };

  /**
   * Delete a saved filter
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const deleteSavedFilter = async function (req, res) {
    try {
      // Check if user has permission to delete saved filters
      if (!(await helper.hasPermission(req.body.requestor, 'deleteSavedFilters'))) {
        res.status(403).send('You are not authorized to delete saved filters.');
        return;
      }

      const { filterId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(filterId)) {
        res.status(400).send('Invalid filter ID.');
        return;
      }

      const filter = await SavedFilter.findById(filterId);
      if (!filter) {
        res.status(404).send('Filter not found.');
        return;
      }

      await SavedFilter.findByIdAndDelete(filterId);
      res.status(200).send('Filter deleted successfully.');
    } catch (error) {
      res.status(500).send(`Internal Error: ${error.message}`);
    }
  };

  /**
   * Update a saved filter
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const updateSavedFilter = async function (req, res) {
    try {
      // Check if user has permission to update saved filters
      if (!(await helper.hasPermission(req.body.requestor, 'createSavedFilters'))) {
        res.status(403).send('You are not authorized to update saved filters.');
        return;
      }

      const { filterId } = req.params;
      const { name, filterConfig } = req.body;

      if (!mongoose.Types.ObjectId.isValid(filterId)) {
        res.status(400).send('Invalid filter ID.');
        return;
      }

      const filter = await SavedFilter.findById(filterId);
      if (!filter) {
        res.status(404).send('Filter not found.');
        return;
      }

      // Validate filter name length if provided
      if (name && name.trim().length > 5) {
        res.status(400).send('Filter name must be 5 characters or less.');
        return;
      }

      // Check if new name already exists (if name is being changed)
      if (name && name.trim() !== filter.name) {
        const existingFilter = await SavedFilter.findOne({ name: name.trim() });
        if (existingFilter) {
          res.status(400).send('Filter name already exists.');
          return;
        }
      }

      const updateData = {};
      if (name) updateData.name = name.trim();
      if (filterConfig) updateData.filterConfig = filterConfig;
      updateData.updatedAt = Date.now();

      const updatedFilter = await SavedFilter.findByIdAndUpdate(filterId, updateData, {
        new: true,
      }).populate('createdBy', 'firstName lastName');

      res.status(200).send(updatedFilter);
    } catch (error) {
      if (error.code === 11000) {
        res.status(400).send('Filter name already exists.');
      } else {
        res.status(500).send(`Internal Error: ${error.message}`);
      }
    }
  };

  /**
   * Update saved filters when team codes change
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const updateSavedFiltersForTeamCodeChange = async function (req, res) {
    try {
      const { oldTeamCodes, newTeamCode } = req.body;

      if (!oldTeamCodes || !Array.isArray(oldTeamCodes) || !newTeamCode) {
        res.status(400).send('Invalid request: oldTeamCodes array and newTeamCode are required.');
        return;
      }

      // Find all saved filters that contain any of the old team codes
      const filtersToUpdate = await SavedFilter.find({
        'filterConfig.selectedCodes': { $in: oldTeamCodes },
      });

      if (filtersToUpdate.length === 0) {
        res.status(200).send({ message: 'No saved filters found with the specified team codes.' });
        return;
      }

      // Update each filter by replacing old team codes with the new one
      const updatePromises = filtersToUpdate.map(async (filter) => {
        const updatedSelectedCodes = filter.filterConfig.selectedCodes.map((code) =>
          oldTeamCodes.includes(code) ? newTeamCode : code,
        );

        // Remove duplicates that might occur after the replacement
        const uniqueCodes = [...new Set(updatedSelectedCodes)];

        filter.filterConfig.selectedCodes = uniqueCodes;
        filter.updatedAt = Date.now();

        return filter.save();
      });

      await Promise.all(updatePromises);

      res.status(200).send({
        message: `Updated ${filtersToUpdate.length} saved filters with new team code.`,
        updatedFilters: filtersToUpdate.length,
      });
    } catch (error) {
      res.status(500).send(`Internal Error: ${error.message}`);
    }
  };

  return {
    getAllSavedFilters,
    createSavedFilter,
    deleteSavedFilter,
    updateSavedFilter,
    updateSavedFiltersForTeamCodeChange,
  };
};

module.exports = savedFilterController;
