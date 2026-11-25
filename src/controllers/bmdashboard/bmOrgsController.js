const bmOrgsController = function () {
  const Organizations = require('../../models/bmdashboard/orgLocation');

  // GET all organizations
  const getAllOrgs = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const query = {};

      if (startDate || endDate) {
        query.startDate = {};

        if (startDate) query.startDate.$gte = new Date(startDate);
        if (endDate) query.startDate.$lte = new Date(endDate);
      }

      const orgs = await Organizations.find(query)
        .select('orgId name description location status startDate endDate country')
        .lean();

      const transformedOrgs = orgs
        .filter((org) => org.location?.coordinates?.length === 2)
        .map((org) => ({
          orgId: org.orgId,
          name: org.name,
          description: org.description,
          latitude: org.location.coordinates[1],
          longitude: org.location.coordinates[0],
          status: org.status,
          startDate: org.startDate,
          endDate: org.endDate,
          country: org.country,
        }));

      return res.status(200).json({
        success: true,
        count: transformedOrgs.length,
        data: transformedOrgs,
      });
    } catch (err) {
      console.error('Error in getAllOrgs:', err);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };

  // GET one organization
  const getOrgById = async (req, res) => {
    try {
      const { id } = req.params;

      const org = await Organizations.findOne({ orgId: id })
        .select('orgId name description location status startDate endDate country')
        .lean();

      if (!org) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          orgId: org.orgId,
          name: org.name,
          description: org.description,
          latitude: org.location.coordinates[1],
          longitude: org.location.coordinates[0],
          status: org.status,
          startDate: org.startDate,
          endDate: org.endDate,
          country: org.country,
        },
      });
    } catch (err) {
      console.error('Error in getOrgById:', err);

      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  };

  // POST create organization
  const createOrg = async (req, res) => {
    try {
      const { orgId, name, description, status, latitude, longitude, country, startDate, endDate } =
        req.body;

      if (
        !orgId ||
        !name ||
        !description ||
        !status ||
        latitude == null ||
        longitude == null ||
        !country ||
        !startDate ||
        !endDate
      ) {
        return res.status(400).json({
          success: false,
          error: 'All organization fields are required.',
        });
      }

      if (typeof orgId !== 'string' || !orgId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid organization ID.',
        });
      }

      const sanitizedOrgId = orgId.trim();

      const existingOrg = await Organizations.findOne({
        orgId: sanitizedOrgId,
      });

      if (existingOrg) {
        return res.status(409).json({
          success: false,
          error: 'Organization ID already exists.',
        });
      }

      const org = await Organizations.create({
        orgId: sanitizedOrgId,
        name,
        description,
        status,
        location: {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)],
        },
        country,
        startDate,
        endDate,
      });

      return res.status(201).json({
        success: true,
        message: 'Organization created successfully.',
        data: org,
      });
    } catch (err) {
      console.error('Error creating organization:', err);
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  };

  // PUT update organization
  const updateOrg = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, status, latitude, longitude, country, startDate, endDate } =
        req.body;

      const org = await Organizations.findOne({ orgId: id });

      if (!org) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
        });
      }

      if (name !== undefined) org.name = name;
      if (description !== undefined) org.description = description;
      if (status !== undefined) org.status = status;
      if (country !== undefined) org.country = country;
      if (startDate !== undefined) org.startDate = startDate;
      if (endDate !== undefined) org.endDate = endDate;

      if (latitude !== undefined || longitude !== undefined) {
        const { coordinates } = org.location;

        const newLongitude = longitude !== undefined ? Number(longitude) : coordinates[0];

        const newLatitude = latitude !== undefined ? Number(latitude) : coordinates[1];

        org.location = {
          type: 'Point',
          coordinates: [newLongitude, newLatitude],
        };
      }

      await org.save();

      return res.status(200).json({
        success: true,
        message: 'Organization updated successfully.',
        data: org,
      });
    } catch (err) {
      console.error('Error updating organization:', err);
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  };

  // DELETE organization
  const deleteOrg = async (req, res) => {
    try {
      const org = await Organizations.findOneAndDelete({
        orgId: req.params.id,
      });

      if (!org) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Organization deleted successfully.',
      });
    } catch (err) {
      console.error('Error deleting organization:', err);
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };

  return {
    getAllOrgs,
    getOrgById,
    createOrg,
    updateOrg,
    deleteOrg,
  };
};

module.exports = bmOrgsController;
