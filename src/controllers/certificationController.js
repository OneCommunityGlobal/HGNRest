const jwt = require('jsonwebtoken');
const Certification = require('../models/certification');
const EducatorCertification = require('../models/educatorCertification');

const PM_CERTIFICATION_ROLES = new Set([
  'Administrator',
  'Owner',
  'Program Manager',
  'Product Manager',
]);

/**
 * Verifies the request's JWT and confirms the caller's role is allowed to
 * access the PM certification endpoints. Returns the decoded token on
 * success, or writes an error response and returns null on failure.
 */
const authorizePmCertificationAccess = (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ error: 'Authorization token missing' });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }

  if (!PM_CERTIFICATION_ROLES.has(decoded.role)) {
    res.status(403).json({ error: 'You are not authorized to access this resource' });
    return null;
  }

  return decoded;
};

const certificationController = function () {
  // Get all Certifications

  const getAllCertifications = async (req, res) => {
    try {
      if (!authorizePmCertificationAccess(req, res)) return;

      const certification = await Certification.find({});
      return res.status(200).json(certification);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  // Get a list of all educators and their certification statuses

  const getAllEducatorCertifications = async (req, res) => {
    try {
      if (!authorizePmCertificationAccess(req, res)) return;

      const { status } = req.query;
      const filter = {};
      if (status) {
        filter.status = String(status);
      }
      const records = await EducatorCertification.find(filter)
        .populate('educatorId', 'firstName lastName email')
        .populate('certificationId', 'name description')
        .populate('assignedBy', 'name email')
        .sort({ assignedAt: -1 });
      res.status(200).json(records);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * Helper: Finds or creates a Certification based on ID or Name
   */
  const getOrCreateCertification = async (id, name, description) => {
    let cert = null;

    if (id) {
      cert = await Certification.findById(id);
      if (!cert) throw new Error('Certification not found');
    } else if (name) {
      if (typeof name !== 'string') {
        throw new TypeError('Invalid certification name format');
      }

      const sanitizedName = String(name);

      cert = await Certification.findOne({ name: sanitizedName });
      if (!cert) {
        cert = await Certification.create({ name: sanitizedName, description: description || '' });
      }
    } else {
      throw new Error('Either certificationId or certificationName must be provided');
    }

    // Common logic: Update description if it differs
    if (description && description !== cert.description) {
      cert.description = description;
      await cert.save();
    }

    return cert;
  };

  /**
   * Main Controller
   */
  const assignOrUpdateCertification = async (req, res) => {
    try {
      const { educatorId } = req.params;
      const { certificationId, certificationName, description, expiryDate, status } = req.body;

      if (!educatorId) return res.status(400).json({ error: 'educatorId is required' });

      // 1. Authorization Handling
      const decoded = authorizePmCertificationAccess(req, res);
      if (!decoded) return;

      const assignedBy = decoded.userid;

      // 2. Certification Logic (Extracted)
      let certToUse;
      try {
        certToUse = await getOrCreateCertification(certificationId, certificationName, description);
      } catch (err) {
        return res
          .status(err.message.includes('not found') ? 404 : 400)
          .json({ error: err.message });
      }

      // 3. Assignment Logic (reject duplicates)
      const query = { educatorId, certificationId: certToUse._id };

      const existing = await EducatorCertification.findOne(query);
      if (existing) {
        return res
          .status(409)
          .json({ error: 'This certification is already assigned to the educator' });
      }

      const assignment = await EducatorCertification.create({
        ...query,
        status,
        expiryDate,
        assignedBy,
      });

      const populated = assignment.populate([
        { path: 'certificationId', select: 'name description' },
        { path: 'assignedBy', select: 'name email' },
      ]);

      return res.status(201).json(populated);
    } catch (error) {
      console.error('SERVER ERROR:', error);
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getAllCertifications,
    getAllEducatorCertifications,
    assignOrUpdateCertification,
  };
};

module.exports = certificationController;
