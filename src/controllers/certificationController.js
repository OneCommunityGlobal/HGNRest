// const mongoose = require('mongoose');
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
      const filter = status ? { status } : {};
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

  // Assign OR update a certification for an educator

  const assignOrUpdateCertification = async (req, res) => {
    try {
      const { educatorId } = req.params;
      const { certificationId, certificationName, description, expiryDate, status } = req.body;

      if (!educatorId) {
        return res.status(400).json({ error: 'educatorId is required' });
      }

      const token = req.headers.authorization;
      if (!token) return res.status(401).json({ error: 'Authorization token missing' });

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        console.error('JWT verification failed:', err);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const assignedBy = decoded.userid;
      let certToUse = null;

      // Handle Certification
      if (certificationId) {
        certToUse = await Certification.findById(certificationId);
        if (!certToUse) return res.status(404).json({ error: 'Certification not found' });

        if (description && description !== certToUse.description) {
          certToUse.description = description;
          await certToUse.save();
        }
      } else if (certificationName) {
        const existingCert = await Certification.findOne({ name: certificationName });

        if (existingCert) {
          certToUse = existingCert;
          if (description && description !== existingCert.description) {
            existingCert.description = description;
            await existingCert.save();
          }
        } else {
          certToUse = await Certification.create({
            name: certificationName,
            description: description || '',
          });
        }
      } else {
        return res.status(400).json({
          error: 'Either certificationId or certificationName must be provided',
        });
      }

      // Check if educator already has this certification
      const existingAssignment = await EducatorCertification.findOne({
        educatorId,
        certificationId: certToUse._id,
      });

      // UPDATE if exists
      if (existingAssignment) {
        existingAssignment.status = status || existingAssignment.status;
        existingAssignment.expiryDate = expiryDate || existingAssignment.expiryDate;
        existingAssignment.assignedBy = assignedBy;

        await existingAssignment.save();

        const populated = await existingAssignment.populate([
          { path: 'certificationId', select: 'name description' },
          { path: 'assignedBy', select: 'name email' },
        ]);

        return res.status(200).json(populated);
      }

      // CREATE new assignment
      const newAssignment = await EducatorCertification.create({
        educatorId,
        certificationId: certToUse._id,
        expiryDate,
        assignedBy,
        status,
      });

      const populated = await newAssignment.populate([
        { path: 'certificationId', select: 'name description' },
        { path: 'assignedBy', select: 'name email' },
      ]);

      return res.status(201).json(populated);
    } catch (error) {
      console.log('SERVER ERROR:', error);
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
