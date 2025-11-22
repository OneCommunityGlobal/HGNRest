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

      const requestTitle = req.body.request_title;
      const requestDetails = req.body.request_details;

      if (!requestTitle || !requestDetails) {
        return res.status(400).send('Request title and request details are required.');
      }

      if (!educatorId) {
        return res.status(400).send('Educator ID is required.');
      }

      const educator = await UserProfile.findById(educatorId);
      if (!educator) {
        return res.status(404).send('Educator not found.');
      }

      if (req.body.pm_id) {
        const pm = await UserProfile.findById(req.body.pm_id);
        if (!pm) {
          return res.status(404).send('Program Manager (PM) not found.');
        }
      }

      if (req.body.status && !['pending', 'approved', 'denied'].includes(req.body.status)) {
        return res.status(400).send('Status must be one of: pending, approved, denied.');
      }

      const newResourceRequest = new ResourceRequest({
        educator_id: mongoose.Types.ObjectId(educatorId),
        pm_id: req.body.pm_id ? mongoose.Types.ObjectId(req.body.pm_id) : null,
        request_title: requestTitle,
        request_details: requestDetails,
        status: req.body.status || 'pending',
      });

      const savedRequest = await newResourceRequest.save();

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

  /**
   * Get all resource requests created by the logged-in educator
   */
  const getEducatorResourceRequests = async (req, res) => {
    try {
      const requestor = req.body.requestor;

      const isEducator =
        requestor?.role === 'Educator' ||
        (await hasPermission(requestor, 'createResourceRequests'));

      if (!isEducator) {
        return res.status(403).send('Only educators can view their own resource requests.');
      }

      const educatorId = requestor?._id;

      const filter = { educator_id: educatorId };

      if (req.query.status) {
        filter.status = req.query.status;
      }

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (error) {
      console.error('Error in getEducatorResourceRequests:', error);
      return res.status(500).send('Error fetching resource requests. Please try again.');
    }
  };

  /**
   * Get all resource requests (PM only)
   */
  const getPMResourceRequests = async (req, res) => {
    try {
      const requestor = req.body.requestor;
      const isPM = await hasPermission(requestor, 'manageResourceRequests');

      if (!isPM && !['Owner', 'Administrator'].includes(requestor?.role)) {
        return res.status(403).send('Only PMs can view all resource requests.');
      }

      const filter = {};

      if (req.query.status) {
        filter.status = req.query.status;
      }

      if (req.query.educator_id) {
        filter.educator_id = req.query.educator_id;
      }

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (error) {
      console.error('Error in getPMResourceRequests:', error);
      return res.status(500).send('Error fetching resource requests.');
    }
  };

  /**
   * Update status of a resource request (PM only)
   */
  const updatePMResourceRequestStatus = async (req, res) => {
    try {
      const requestor = req.body.requestor;
      const isPM = await hasPermission(requestor, 'manageResourceRequests');

      if (!isPM && !['Owner', 'Administrator'].includes(requestor?.role)) {
        return res.status(403).send('Only PMs can update resource request status.');
      }

      const requestId = req.params.id;
      const newStatus = req.body.status;

      if (!['approved', 'denied', 'pending'].includes(newStatus)) {
        return res.status(400).send('Invalid status value.');
      }

      const existingRequest = await ResourceRequest.findById(requestId);
      if (!existingRequest) {
        return res.status(404).send('Resource request not found.');
      }

      existingRequest.status = newStatus;
      existingRequest.pm_id = requestor._id;

      const updated = await existingRequest.save();

      const populated = await ResourceRequest.findById(updated._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(populated);
    } catch (error) {
      console.error('Error in updatePMResourceRequestStatus:', error);
      return res.status(500).send('Error updating resource request status.');
    }
  };

  return {
    createResourceRequest,
    getEducatorResourceRequests,
    getPMResourceRequests,
    updatePMResourceRequestStatus,
  };
};

module.exports = resourceRequestController;
