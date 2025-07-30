const ApplicantVolunteerRatio = require('../models/applicantVolunteerRatio');

const applicantVolunteerRatioController = function () {
  // Get all applicant volunteer ratio data
  const getAllApplicantVolunteerRatios = async function (req, res) {
    try {
      const ratios = await ApplicantVolunteerRatio.find({}).sort({ createdAt: -1 });

      res.status(200).send(ratios);
    } catch (error) {
      console.error('Error fetching applicant volunteer ratios:', error);
      res.status(500).send({ error: 'Failed to fetch applicant volunteer ratios' });
    }
  };

  // Get applicant volunteer ratio by ID
  const getApplicantVolunteerRatioById = async function (req, res) {
    try {
      const { id } = req.params;

      const ratio = await ApplicantVolunteerRatio.findById(id);

      if (!ratio) {
        return res.status(404).send({ error: 'Applicant volunteer ratio not found' });
      }

      res.status(200).send(ratio);
    } catch (error) {
      console.error('Error fetching applicant volunteer ratio:', error);
      res.status(500).send({ error: 'Failed to fetch applicant volunteer ratio' });
    }
  };

  // Create new applicant volunteer ratio
  const createApplicantVolunteerRatio = async function (req, res) {
    try {
      const { role, totalApplicants, totalHired } = req.body;

      // Validate required fields
      if (!role || totalApplicants === undefined || totalHired === undefined) {
        return res.status(400).send({
          error: 'Role, totalApplicants, and totalHired are required fields',
        });
      }

      // Check if role already exists
      const existingRatio = await ApplicantVolunteerRatio.findOne({ role });
      if (existingRatio) {
        return res.status(400).send({
          error: `Applicant volunteer ratio for role '${role}' already exists`,
        });
      }

      const newRatio = new ApplicantVolunteerRatio({
        role,
        totalApplicants,
        totalHired,
      });

      const savedRatio = await newRatio.save();
      res.status(201).send(savedRatio);
    } catch (error) {
      console.error('Error creating applicant volunteer ratio:', error);
      res.status(500).send({ error: 'Failed to create applicant volunteer ratio' });
    }
  };

  // Update applicant volunteer ratio
  const updateApplicantVolunteerRatio = async function (req, res) {
    try {
      const { id } = req.params;
      const { role, totalApplicants, totalHired } = req.body;

      // Validate required fields
      if (!role || totalApplicants === undefined || totalHired === undefined) {
        return res.status(400).send({
          error: 'Role, totalApplicants, and totalHired are required fields',
        });
      }

      // Check if role already exists for a different record
      const existingRatio = await ApplicantVolunteerRatio.findOne({
        role,
        _id: { $ne: id },
      });
      if (existingRatio) {
        return res.status(400).send({
          error: `Applicant volunteer ratio for role '${role}' already exists`,
        });
      }

      const updatedRatio = await ApplicantVolunteerRatio.findByIdAndUpdate(
        id,
        { role, totalApplicants, totalHired },
        { new: true, runValidators: true },
      );

      if (!updatedRatio) {
        return res.status(404).send({ error: 'Applicant volunteer ratio not found' });
      }

      res.status(200).send(updatedRatio);
    } catch (error) {
      console.error('Error updating applicant volunteer ratio:', error);
      res.status(500).send({ error: 'Failed to update applicant volunteer ratio' });
    }
  };

  // Delete applicant volunteer ratio
  const deleteApplicantVolunteerRatio = async function (req, res) {
    try {
      const { id } = req.params;

      const deletedRatio = await ApplicantVolunteerRatio.findByIdAndDelete(id);

      if (!deletedRatio) {
        return res.status(404).send({ error: 'Applicant volunteer ratio not found' });
      }

      res.status(200).send({ message: 'Applicant volunteer ratio deleted successfully' });
    } catch (error) {
      console.error('Error deleting applicant volunteer ratio:', error);
      res.status(500).send({ error: 'Failed to delete applicant volunteer ratio' });
    }
  };

  return {
    getAllApplicantVolunteerRatios,
    getApplicantVolunteerRatioById,
    createApplicantVolunteerRatio,
    updateApplicantVolunteerRatio,
    deleteApplicantVolunteerRatio,
  };
};

module.exports = applicantVolunteerRatioController;
