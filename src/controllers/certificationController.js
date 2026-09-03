const jwt = require('jsonwebtoken');
const Certification = require('../models/certification');
const EducatorCertification = require('../models/educatorCertification');

const certificationController = function () {
  // Get all Certifications

  const getAllCertifications = async (req, res) => {
    try {
      const certification = await Certification.find({});
      return res.status(200).json(certification);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  // Get a list of all educators and their certification statuses

  const getAllEducatorCertifications = async (req, res) => {
    try {
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
        throw new Error('Invalid certification name format');
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
      const token = req.headers.authorization;
      if (!token) return res.status(401).json({ error: 'Authorization token missing' });

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

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

      // 3. Assignment Logic (Upsert)
      const query = { educatorId, certificationId: certToUse._id };
      const updateData = {
        status,
        expiryDate,
        assignedBy,
      };

      // We check existence to determine the correct HTTP status (200 vs 201)
      let assignment = await EducatorCertification.findOne(query);
      const isNew = !assignment;

      if (isNew) {
        assignment = await EducatorCertification.create({ ...query, ...updateData });
      } else {
        Object.assign(assignment, updateData);
        await assignment.save();
      }

      const populated = await assignment.populate([
        { path: 'certificationId', select: 'name description' },
        { path: 'assignedBy', select: 'name email' },
      ]);

      return res.status(isNew ? 201 : 200).json(populated);
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
