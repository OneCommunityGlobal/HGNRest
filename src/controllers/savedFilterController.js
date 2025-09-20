const mongoose = require('mongoose');
const SavedFilter = require('../models/savedFilter');

const savedFilterController = function () {
  /**
   * Helper function to check if user has admin role
   * @param {Object} user - User object
   * @returns {boolean} - True if user is Owner or Administrator
   */
  const hasAdminRole = function (user) {
    return user && user.role && (user.role === 'Owner' || user.role === 'Administrator');
  };

  /**
   * Get all saved filters
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const getAllSavedFilters = async function (req, res) {
    try {
      // Check if user has admin role
      if (!hasAdminRole(req.body.requestor)) {
        res
          .status(403)
          .send(
            'You are not authorized to view saved filters. Only Owners and Administrators can access saved filters.',
          );
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
      // Check if user has admin role
      if (!hasAdminRole(req.body.requestor)) {
        res
          .status(403)
          .send(
            'You are not authorized to create saved filters. Only Owners and Administrators can create saved filters.',
          );
        return;
      }

      const { name, filterConfig } = req.body;

      // Validate filter name length
      if (!name || name.trim().length > 7) {
        res.status(400).send('Filter name must be 7 characters or less.');
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
        createdBy: req.body.requestor.requestorId,
      });

      const savedFilterDoc = await newFilter.save();
      const populatedFilter = await SavedFilter.findById(savedFilterDoc._id).populate(
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
      // Check if user has admin role
      if (!hasAdminRole(req.body.requestor)) {
        res
          .status(403)
          .send(
            'You are not authorized to delete saved filters. Only Owners and Administrators can delete saved filters.',
          );
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
      // Check if user has admin role
      if (!hasAdminRole(req.body.requestor)) {
        res
          .status(403)
          .send(
            'You are not authorized to update saved filters. Only Owners and Administrators can update saved filters.',
          );
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
      if (name && name.trim().length > 7) {
        res.status(400).send('Filter name must be 7 characters or less.');
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

  /**
   * Update saved filters when individual team code changes
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  const updateSavedFiltersForIndividualTeamCodeChange = async function (req, res) {
    try {
      const { oldTeamCode, newTeamCode, userId } = req.body;

      if (!oldTeamCode || !newTeamCode || !userId) {
        res.status(400).send('Invalid request: oldTeamCode, newTeamCode, and userId are required.');
        return;
      }

      // Find all saved filters that contain the old team code
      const filtersToUpdate = await SavedFilter.find({
        'filterConfig.selectedCodes': oldTeamCode,
      });

      if (filtersToUpdate.length === 0) {
        res.status(200).send({ message: 'No saved filters found with the specified team code.' });
        return;
      }

      // Update each filter by adding the new team code to the existing codes
      const updatePromises = filtersToUpdate.map(async (filter) => {
        // Add the new team code to the existing codes (don't replace, just add)
        const updatedSelectedCodes = [...filter.filterConfig.selectedCodes, newTeamCode];

        // Remove duplicates
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
    updateSavedFiltersForIndividualTeamCodeChange,
  };
};

module.exports = savedFilterController;
