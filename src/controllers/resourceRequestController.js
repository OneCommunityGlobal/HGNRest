const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');

const ALLOWED_STATUSES = ['pending', 'approved', 'denied'];

const sanitizeString = (str) => (typeof str === 'string' ? str.trim() : '');

const resourceRequestController = (ResourceRequest, UserProfile) => {
  const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

  const createResourceRequest = async (req, res) => {
    try {
      const { requestor } = req.body;

      if (!requestor?.requestorId) {
        return res.status(401).send('Authentication required.');
      }

      const isEducator =
        requestor.role === 'Educator' || (await hasPermission(requestor, 'createResourceRequests'));

      if (!isEducator) {
        return res.status(403).send('Only educators can submit resource requests.');
      }

      const { request_title: rawTitle, request_details: rawDetails } = req.body;
      const requestTitle = sanitizeString(rawTitle);
      const requestDetails = sanitizeString(rawDetails);

      if (!requestTitle || !requestDetails) {
        return res.status(400).send('Request title and details are required.');
      }

      if (requestTitle.length > 200 || requestDetails.length > 2000) {
        return res.status(400).send('Request title or details exceed maximum length.');
      }

      const newRequest = new ResourceRequest({
        educator_id: requestor.requestorId,
        request_title: requestTitle,
        request_details: requestDetails,
        status: 'pending',
      });

      const saved = await newRequest.save();

      const populated = await ResourceRequest.findById(saved._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(201).send(populated);
    } catch (err) {
      return res.status(500).send('Error creating resource request.');
    }
  };

  const getEducatorResourceRequests = async (req, res) => {
    try {
      const { requestor } = req.body;

      if (!requestor?.requestorId) {
        return res.status(401).send('Authentication required.');
      }

      const isEducator =
        requestor.role === 'Educator' || (await hasPermission(requestor, 'createResourceRequests'));

      if (!isEducator) {
        return res.status(403).send('Only educators can view their resource requests.');
      }

      const filter = { educator_id: requestor.requestorId };

      if (req.query.status && ALLOWED_STATUSES.includes(req.query.status)) {
        filter.status = req.query.status;
      }

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (err) {
      return res.status(500).send('Error fetching educator requests.');
    }
  };

  const getPMResourceRequests = async (req, res) => {
    try {
      const { requestor } = req.body;

      if (!requestor?.requestorId) {
        return res.status(401).send('Authentication required.');
      }

      const isPM =
        requestor.role === 'Program Manager' ||
        (await hasPermission(requestor, 'manageResourceRequests'));

      if (!isPM && !['Owner', 'Administrator'].includes(requestor.role)) {
        return res.status(403).send('Only PMs can view all resource requests.');
      }

      const filter = {};

      if (req.query.status && ALLOWED_STATUSES.includes(req.query.status)) {
        filter.status = req.query.status;
      }
      if (req.query.educator_id && isValidId(req.query.educator_id)) {
        filter.educator_id = req.query.educator_id;
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const page = Math.max(Number(req.query.page) || 1, 1);

      const requests = await ResourceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(requests);
    } catch (err) {
      return res.status(500).send('Error fetching resource requests.');
    }
  };

  const updatePMResourceRequestStatus = async (req, res) => {
    try {
      const { requestor } = req.body;

      if (!requestor?.requestorId) {
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

      if (!ALLOWED_STATUSES.includes(newStatus)) {
        return res.status(400).send('Invalid status value.');
      }

      const request = await ResourceRequest.findById(requestId);

      if (!request) {
        return res.status(404).send('Resource request not found.');
      }

      request.status = newStatus;
      request.pm_id = requestor.requestorId;

      const updated = await request.save();

      const populated = await ResourceRequest.findById(updated._id)
        .populate('educator_id', 'firstName lastName email role')
        .populate('pm_id', 'firstName lastName email role');

      return res.status(200).send(populated);
    } catch (err) {
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
