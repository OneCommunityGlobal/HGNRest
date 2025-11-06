// const mongoose = require('mongoose');

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
      const filter = status ? { status } : {};
      const records = await EducatorCertification.find(filter)
        .populate('educatorId', 'name email')
        .populate('certificationId', 'name description')
        .populate('assignedBy', 'name email')
        .sort({ assignedAt: -1 });
      res.status(200).json(records);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Assign a new certification or update an existing one for an educator
  const assignOrUpdateCertification = async (req, res) => {
    try {
      const { educatorId } = req.params;
      const { certificationId, certificationName, description, assignedBy, expiryDate, status } =
        req.body;

      // Validate educator info
      if (!educatorId) {
        return res.status(400).json({ error: 'educatorId is required' });
      }

      let certToUse = null;

      // Handle existing certification or create a new one
      if (certificationId) {
        certToUse = await Certification.findById(certificationId);
        if (!certToUse) {
          return res.status(404).json({ error: 'Certification not found' });
        }
      } else if (certificationName) {
        // Check if certification with the same name exists
        const existingCert = await Certification.findOne({ name: certificationName });
        if (existingCert) {
          certToUse = existingCert;
        } else {
          // Create new certification
          const newCert = new Certification({
            name: certificationName,
            description: description || '',
          });
          certToUse = await newCert.save();
        }
      } else {
        return res.status(400).json({
          error: 'Either certificationId or certificationName must be provided',
        });
      }

      //  Prevent duplicate assignment
      const existingAssignment = await EducatorCertification.findOne({
        educatorId,
        certificationId: certToUse._id,
      });

      if (existingAssignment) {
        return res.status(400).json({ error: 'Certification already assigned to this educator' });
      }

      // Assign certification to educator
      const educatorCert = new EducatorCertification({
        educatorId,
        certificationId: certToUse._id,
        expiryDate,
        assignedBy,
        status,
      });

      const saved = await educatorCert.save();

      const populated = await saved.populate([
        { path: 'certificationId', select: 'name description' },
        { path: 'assignedBy', select: 'name email' },
      ]);

      res.status(201).json(populated);
    } catch (error) {
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
