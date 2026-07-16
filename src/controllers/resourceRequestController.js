const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');

const ALLOWED_STATUSES = ['pending', 'approved', 'denied'];

const sanitizeString = (str) => (typeof str === 'string' ? str.trim() : '');

const sanitizeStatus = (raw) => {
  if (typeof raw !== 'string') return null;
  const val = raw.trim();
  return ALLOWED_STATUSES.includes(val) ? String(val) : null;
};

const sanitizeObjectId = (raw) => {
  if (typeof raw !== 'string') return null;
  const val = raw.trim();
  if (!mongoose.Types.ObjectId.isValid(val)) return null;
  return new mongoose.Types.ObjectId(val);
};

const resourceRequestController = (ResourceRequest, UserProfile) => {
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

      const educatorId = sanitizeObjectId(requestor.requestorId);
      if (!educatorId) {
        return res.status(400).send('Invalid educator ID.');
      }

      const newRequest = new ResourceRequest({
        educator_id: educatorId,
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

      const educatorId = sanitizeObjectId(requestor.requestorId);
      if (!educatorId) {
        return res.status(400).send('Invalid educator ID.');
      }

      const filter = { educator_id: educatorId };

      const status = sanitizeStatus(req.query.status);
      if (status) {
        filter.status = status;
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

      const status = sanitizeStatus(req.query.status);
      if (status) {
        filter.status = status;
      }

      const educatorId = sanitizeObjectId(req.query.educator_id);
      if (educatorId) {
        filter.educator_id = educatorId;
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

      const requestId = sanitizeObjectId(req.params.id);
      if (!requestId) {
        return res.status(400).send('Invalid request ID.');
      }

      const newStatus = sanitizeStatus(req.body.status);
      if (!newStatus) {
        return res.status(400).send('Invalid status value.');
      }

      const request = await ResourceRequest.findById(requestId);

      if (!request) {
        return res.status(404).send('Resource request not found.');
      }

      request.status = newStatus;

      const pmId = sanitizeObjectId(requestor.requestorId);
      if (pmId) {
        request.pm_id = pmId;
      }

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
