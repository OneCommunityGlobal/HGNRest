/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable prefer-destructuring */
const mongoose = require('mongoose');
const Task = require('../../models/task');
const Cost = require('../../models/costs');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const { getProjectRegion } = require('../../utilities/projectRegion');

const EDITABLE_STATUSES = new Set(['active', 'delayed', 'completed']);
const PROJECT_ADMIN_ROLES = new Set(['Owner', 'Administrator']);
const PROJECT_COST_CATEGORIES = {
  materials: 'Total Cost of Materials',
  equipment: 'Total Cost of Equipment',
};

const normalizeStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return EDITABLE_STATUSES.has(normalized) ? normalized : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const normalized = parsed.toISOString().slice(0, 10);
    if (normalized !== value) return null;
  }
  return parsed;
};

const buildProjectLocationFilter = ({ startDate, endDate, status } = {}) => {
  const filter = {
    latitude: { $type: 'number' },
    longitude: { $type: 'number' },
  };

  if (status) {
    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) return { error: 'Invalid project status' };
    filter.status = normalizedStatus;
  }

  if (startDate || endDate) {
    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);
    if ((startDate && !parsedStartDate) || (endDate && !parsedEndDate)) {
      return { error: 'Dates must be valid ISO dates' };
    }
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return { error: 'End date cannot be before start date' };
    }
    filter.startDate = {};
    if (parsedStartDate) filter.startDate.$gte = parsedStartDate;
    if (parsedEndDate) filter.startDate.$lte = parsedEndDate;
  }

  return { filter };
};

const mapProjectLocation = (project) => ({
  orgId: project._id,
  name: project.name,
  address: project.address,
  city: project.city,
  country: project.country,
  latitude: project.latitude,
  longitude: project.longitude,
  status: project.status,
  startDate: project.startDate,
  endDate: project.endDate,
});

const validateProjectPayload = (body = {}) => {
  const name = String(body.name || '').trim();
  const address = String(body.address || '').trim();
  const city = String(body.city || '').trim();
  const country = String(body.country || '').trim();
  const status = normalizeStatus(body.status);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (!name) return { message: 'Project name is required', field: 'name' };
  if (!address && !city) {
    return { message: 'Address or city is required', field: 'location' };
  }
  if (!country) return { message: 'Country is required', field: 'country' };
  if (!status) return { message: 'Status must be active, delayed, or completed', field: 'status' };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { message: 'Latitude must be a number between -90 and 90', field: 'latitude' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { message: 'Longitude must be a number between -180 and 180', field: 'longitude' };
  }
  if (!startDate) return { message: 'Start date is required', field: 'startDate' };
  if (!endDate) return { message: 'Planned end date is required', field: 'endDate' };
  if (endDate < startDate) {
    return { message: 'Planned end date cannot be before the start date', field: 'endDate' };
  }

  return {
    value: {
      name,
      address: address || undefined,
      city: city || undefined,
      country,
      region: getProjectRegion(country),
      location: address || city,
      latitude,
      longitude,
      status,
      startDate,
      endDate,
      isActive: status !== 'completed',
    },
  };
};

const requireProjectAdmin = (req, res) => {
  if (!PROJECT_ADMIN_ROLES.has(req.user?.role)) {
    res.status(403).json({ message: 'Only Owners and Administrators can manage projects.' });
    return false;
  }
  return true;
};

const getProjectCosts = async (projects) => {
  const projectIds = projects
    .map((project) => project._id)
    .filter((projectId) => mongoose.Types.ObjectId.isValid(projectId));

  if (!projectIds.length) return new Map();

  const rows = await Cost.aggregate([
    {
      $match: {
        projectId: { $in: projectIds },
        category: { $in: Object.values(PROJECT_COST_CATEGORIES) },
      },
    },
    {
      $group: {
        _id: { projectId: '$projectId', category: '$category' },
        amount: { $sum: '$amount' },
      },
    },
  ]);

  return rows.reduce((costsByProject, row) => {
    const projectId = row._id.projectId.toString();
    const projectCosts = costsByProject.get(projectId) || {};

    if (row._id.category === PROJECT_COST_CATEGORIES.materials) {
      projectCosts.totalMaterialsCost = row.amount;
    }
    if (row._id.category === PROJECT_COST_CATEGORIES.equipment) {
      projectCosts.totalEquipmentCost = row.amount;
    }

    costsByProject.set(projectId, projectCosts);
    return costsByProject;
  }, new Map());
};

const attachProjectSummaryData = (projects, costsByProject) => {
  projects.forEach((project) => {
    const materials = Array.isArray(project.materials) ? project.materials : [];
    const projectCosts = costsByProject.get(project._id.toString()) || {};

    project.totalMaterialsCost = projectCosts.totalMaterialsCost ?? null;
    project.totalEquipmentCost = projectCosts.totalEquipmentCost ?? null;
    project.mostMaterialWaste = materials.reduce(
      (mostWasted, material) =>
        !mostWasted || material.stockWasted > mostWasted.stockWasted ? material : mostWasted,
      null,
    );
    project.leastMaterialAvailable = materials.reduce(
      (leastAvailable, material) =>
        !leastAvailable || material.stockAvailable < leastAvailable.stockAvailable
          ? material
          : leastAvailable,
      null,
    );
    project.mostMaterialBought = materials.reduce(
      (mostBought, material) =>
        !mostBought || material.stockBought > mostBought.stockBought ? material : mostBought,
      null,
    );

    const rental = project.rentalRecords?.[0];
    project.rentalSummary = rental
      ? { itemName: rental.itemName, rentalDueDate: rental.rentalDueDate }
      : null;
    delete project.rentalRecords;
  });

  return projects;
};

const bmMProjectController = function () {
  const fetchAllProjects = async (req, res) => {
    try {
      const projects = await BuildingProject.aggregate([
        {
          $lookup: {
            from: 'userProfiles',
            let: { id: '$buildingManager' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
              { $project: { firstName: 1, lastName: 1, email: 1 } },
            ],
            as: 'buildingManager',
          },
        },
        { $unwind: { path: '$buildingManager', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'buildingInventoryItems',
            let: { id: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project', '$$id'] } } },
              { $match: { __t: 'material_item' } },
              { $project: { updateRecord: 0, project: 0 } },
              {
                $lookup: {
                  from: 'buildingInventoryTypes',
                  localField: 'itemType',
                  foreignField: '_id',
                  as: 'itemType',
                },
              },
              {
                $unwind: '$itemType',
              },
            ],
            as: 'materials',
          },
        },
        {
          $lookup: {
            from: 'buildingInventoryItems',
            let: { id: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$project', '$$id'] },
                      { $eq: ['$__t', 'equipment_item'] },
                      { $in: ['$purchaseStatus', ['Rental', 'Rented']] },
                    ],
                  },
                  rentalDueDate: { $type: 'date' },
                },
              },
              { $sort: { rentalDueDate: 1 } },
              { $limit: 1 },
              {
                $lookup: {
                  from: 'buildingInventoryTypes',
                  localField: 'itemType',
                  foreignField: '_id',
                  as: 'itemType',
                },
              },
              { $unwind: { path: '$itemType', preserveNullAndEmptyArrays: true } },
              { $project: { _id: 0, itemName: '$itemType.name', rentalDueDate: 1 } },
            ],
            as: 'rentalRecords',
          },
        },
        {
          $project: {
            name: 1,
            isActive: 1,
            template: 1,
            location: 1,
            address: 1,
            city: 1,
            country: 1,
            latitude: 1,
            longitude: 1,
            status: 1,
            startDate: 1,
            endDate: 1,
            dateCreated: 1,
            buildingManager: 1,
            teams: 1,
            members: 1,
            materials: 1,
            rentalRecords: 1,
            hoursWorked: { $sum: '$members.hours' },
          },
        },
      ]);
      const costsByProject = await getProjectCosts(projects);
      return res.status(200).send(attachProjectSummaryData(projects, costsByProject));
    } catch (err) {
      return res.status(500).send(err);
    }
  };

  // fetches single project by project id
  const fetchSingleProject = async (req, res) => {
    //! Note: for easier testing this route currently returns the project without an auth check
    // TODO: uncomment the lines below to check the user's ability to view the current project
    // const token = req.headers.authorization;
    // const { userid } = jwt.verify(token, JWT_SECRET);
    const { projectId } = req.params;
    try {
      BuildingProject.findById(projectId)
        .populate([
          {
            path: 'buildingManager',
            select: '_id firstName lastName email',
          },
          {
            path: 'team',
            select: '_id firstName lastName email',
          },
        ])
        .exec()
        .then((project) => res.status(200).send(project))
        // TODO: uncomment this block to execute the auth check
        // authenticate request by comparing userId param with buildingManager id field
        // Note: _id has type object and must be converted to string
        // .then((project) => {
        //   if (userid !== project.buildingManager._id.toString()) {
        //     return res.status(403).send({
        //       message: 'You are not authorized to view this record.',
        //     });
        //   }
        //   return res.status(200).send(project);
        // })
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const fetchProjectsWithLocation = async (req, res) => {
    try {
      const { filter, error } = buildProjectLocationFilter(req.query);
      if (error) return res.status(400).json({ message: error });

      const projects = await BuildingProject.find(filter)
        .select('_id name address city country latitude longitude status startDate endDate')
        .lean();

      return res.status(200).json({
        success: true,
        count: projects.length,
        data: projects.map(mapProjectLocation),
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to retrieve projects with location' });
    }
  };

  const createProject = async (req, res) => {
    if (!requireProjectAdmin(req, res)) return;

    const validation = validateProjectPayload(req.body);
    if (validation.message) return res.status(400).json(validation);

    try {
      const projectData = { ...validation.value };
      if (mongoose.Types.ObjectId.isValid(req.user?.requestorId)) {
        projectData.buildingManager = req.user.requestorId;
      }
      const project = await BuildingProject.create(projectData);
      return res.status(201).json(project);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to create project' });
    }
  };

  const updateProject = async (req, res) => {
    if (!requireProjectAdmin(req, res)) return;

    const validation = validateProjectPayload(req.body);
    if (validation.message) return res.status(400).json(validation);

    try {
      const project = await BuildingProject.findById(req.params.projectId);
      if (!project) return res.status(404).json({ message: 'Project not found' });

      project.set(validation.value);
      await project.save();
      return res.status(200).json(project);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update project' });
    }
  };

  const fetchProjectsNames = async (req, res) => {
    try {
      // Query all active projects from database (unchanged)
      const projects = await BuildingProject.find(
        { isActive: true }, // only active projects
        { _id: 1, name: 1 }, // only select id + name
      );

      let projectNames = projects.map((proj) => ({
        projectId: proj._id,
        projectName: proj.name,
      }));

      // Optional filtering: only include projects that have issues
      // Used by Issues Breakdown Chart to avoid showing projects with no data
      if (req.query.withIssuesOnly === 'true') {
        // Get distinct project IDs that have issues
        const projectIdsWithIssues = await BuildingIssue.distinct('projectId');
        const projectIdsWithIssuesSet = new Set(projectIdsWithIssues.map((id) => id.toString()));

        // Filter to only include projects that have issues
        projectNames = projectNames.filter((proj) =>
          projectIdsWithIssuesSet.has(proj.projectId.toString()),
        );
      }

      res.status(200).json(projectNames);
    } catch (error) {
      console.error('Error in fetchProjectNames:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const fetchProjectMembers = async (req, res) => {
    const { projectId } = req.params;
    try {
      BuildingProject.findById(projectId)
        .populate({ path: 'buildingManager', select: '_id firstName lastName email' })
        // .populate({
        //   path: 'teams',
        //   select: '_id teamName'
        // })
        .populate({
          path: 'members',
          populate: [
            {
              path: 'user',
              select: '_id firstName lastName email role teams',
            },
          ],
        })
        .exec()
        .then((project) => {
          project.members.forEach((member) => {
            const userId = member.user._id;
            try {
              Task.find({
                'resources.userID': mongoose.Types.ObjectId(userId),
              }).then((results) => {
                // console.log("results", results);
                if (results[0]?.taskName) {
                  const memberTaskName = results[0].taskName;
                  // console.log("memberTaskName: ", memberTaskName);
                  // Not working because of db access latency, maybe need to implement separate signaling to fetch task name
                  // also needs to add 'task' field to insert memberTaskName rather than using teams field
                  member.user.teams[0] = memberTaskName;
                  // console.log("member: ", member);
                }
              });
            } catch (error) {
              console.log('error');
            }
          });
          return project;
        })
        .then((project) => res.status(200).send(project))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return {
    fetchAllProjects,
    fetchSingleProject,
    fetchProjectsNames,
    fetchProjectMembers,
    fetchProjectsWithLocation,
    createProject,
    updateProject,
  };
};

module.exports = bmMProjectController;
