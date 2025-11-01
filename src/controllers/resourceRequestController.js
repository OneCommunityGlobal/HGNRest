const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');

const resourceRequestController = function (ResourceRequest, UserProfile) {
  /**
   * Create a new resource request for educators
   * @param {Object} req - Request object containing requestor and request data
   * @param {Object} res - Response object
   */
  const createResourceRequest = async (req, res) => {
    try {
      // Check if user has permission or is creating their own request
      const requestorId = req.body.requestor?.requestorId || req.body.requestor?._id;
      const educatorId = req.body.educator_id || requestorId;

      const isCreatingOwnRequest =
        educatorId && requestorId && educatorId.toString() === requestorId.toString();
      const hasRolePermission = ['Owner', 'Administrator'].includes(req.body.requestor?.role);

      if (
        !isCreatingOwnRequest &&
        !hasRolePermission &&
        !(await hasPermission(req.body.requestor, 'manageResourceRequests'))
      ) {
        return res.status(403).send('You are not authorized to create resource requests.');
      }

      // Validate required fields
      const requestTitle = req.body.request_title;
      const requestDetails = req.body.request_details;

      if (!requestTitle || !requestDetails) {
        return res.status(400).send('Request title and request details are required.');
      }

      if (!educatorId) {
        return res.status(400).send('Educator ID is required.');
      }

      // Validate educator exists
      const educator = await UserProfile.findById(educatorId);
      if (!educator) {
        return res.status(404).send('Educator not found.');
      }

      // Validate PM if provided
      if (req.body.pm_id) {
        const pm = await UserProfile.findById(req.body.pm_id);
        if (!pm) {
          return res.status(404).send('Program Manager (PM) not found.');
        }
      }

      // Validate status if provided
      if (req.body.status && !['pending', 'approved', 'denied'].includes(req.body.status)) {
        return res.status(400).send('Status must be one of: pending, approved, denied.');
      }

      // Create new resource request
      const newResourceRequest = new ResourceRequest({
        educator_id: mongoose.Types.ObjectId(educatorId),
        pm_id: req.body.pm_id ? mongoose.Types.ObjectId(req.body.pm_id) : null,
        request_title: requestTitle,
        request_details: requestDetails,
        status: req.body.status || 'pending',
      });

      const savedRequest = await newResourceRequest.save();

      // Populate the educator and pm fields for response
      const populatedRequest = await ResourceRequest.findById(savedRequest._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(201).send(populatedRequest);
    } catch (error) {
      console.error('Error in createResourceRequest:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).send(`Validation error: ${error.message}`);
      }
      return res.status(500).send('Error creating resource request. Please try again.');
    }
  };

  return {
    createResourceRequest,
  };
};

module.exports = resourceRequestController;
