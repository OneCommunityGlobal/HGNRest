const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');

const resourceRequestController = (ResourceRequest, UserProfile) => {
  // Helper: Validate ObjectId
  const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

  /**
   * Create a new resource request (Educator only)
   */
  const createResourceRequest = async (req, res) => {
    try {
      const requestor = req.requestor || req.body.requestor;

      if (!requestor?._id) {
        return res.status(401).send('Authentication required.');
      }

      const educatorId = requestor._id;

      const isEducator =
        requestor.role === 'Educator' ||
        (await hasPermission(requestor, 'createResourceRequests'));

      if (!isEducator) {
        return res.status(403).send('Only educators can submit resource requests.');
      }

      const { request_title, request_details } = req.body;

      if (!request_title || !request_details) {
        return res.status(400).send('Request title and details are required.');
      }

      // Educators CANNOT set or override status
      const newRequest = new ResourceRequest({
        educator_id: educatorId,
        request_title,
        request_details,
        status: 'pending',
      });

      const saved = await newRequest.save();

      const populated = await ResourceRequest.findById(saved._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(201).send(populated);
    } catch (err) {
      console.error('Error in createResourceRequest:', err);
      return res.status(500).send('Error creating resource request.');
    }
  };

  /**
   * Get resource requests for the logged-in educator
   */
  const getEducatorResourceRequests = async (req, res) => {
    try {
      const requestor = req.requestor || req.body.requestor;

      if (!requestor?._id) {
        return res.status(401).send('Authentication required.');
      }

      const isEducator =
        requestor.role === 'Educator' ||
        (await hasPermission(requestor, 'createResourceRequests'));

      if (!isEducator) {
        return res.status(403).send('Only educators can view their resource requests.');
      }

      const filter = { educator_id: requestor._id };

      if (req.query.status) {
        filter.status = req.query.status;
      }

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (err) {
      console.error('Error in getEducatorResourceRequests:', err);
      return res.status(500).send('Error fetching educator requests.');
    }
  };

  /**
   * PM: View all resource requests
   */
  const getPMResourceRequests = async (req, res) => {
    try {
      const requestor = req.requestor || req.body.requestor;

      if (!requestor?._id) {
        return res.status(401).send('Authentication required.');
      }

      const isPM =
        requestor.role === 'Program Manager' ||
        (await hasPermission(requestor, 'manageResourceRequests'));

      if (!isPM && !['Owner', 'Administrator'].includes(requestor.role)) {
        return res.status(403).send('Only PMs can view all resource requests.');
      }

      const filter = {};

      if (req.query.status) filter.status = req.query.status;
      if (req.query.educator_id && isValidId(req.query.educator_id)) {
        filter.educator_id = req.query.educator_id;
      }

      // Pagination
      const limit = Number(req.query.limit) || 20;
      const page = Number(req.query.page) || 1;

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (err) {
      console.error('Error in getPMResourceRequests:', err);
      return res.status(500).send('Error fetching resource requests.');
    }
  };

  /**
   * PM: Update request status
   */
  const updatePMResourceRequestStatus = async (req, res) => {
    try {
      const requestor = req.requestor || req.body.requestor;

      if (!requestor?._id) {
        return res.status(401).send('Authentication required.');
      }

      const isPM =
        requestor.role === 'Program Manager' ||
        (await hasPermission(requestor, 'manageResourceRequests'));

      if (!isPM && !['Owner', 'Administrator'].includes(requestor.role)) {
        return res.status(403).send('Only PMs can update resource requests.');
      }

      const requestId = req.params.id;

      if (!isValidId(requestId)) {
        return res.status(400).send('Invalid request ID.');
      }

      const newStatus = req.body.status;

      if (!['approved', 'denied', 'pending'].includes(newStatus)) {
        return res.status(400).send('Invalid status value.');
      }

      const request = await ResourceRequest.findById(requestId);

      if (!request) {
        return res.status(404).send('Resource request not found.');
      }

      request.status = newStatus;
      request.pm_id = requestor._id;

      const updated = await request.save();

      const populated = await ResourceRequest.findById(updated._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(populated);
    } catch (err) {
      console.error('Error in updatePMResourceRequestStatus:', err);
      return res.status(500).send('Error updating resource request.');
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
