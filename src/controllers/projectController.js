/* eslint-disable quotes */
/* eslint-disable arrow-parens */
const mongoose = require('mongoose');
const timeentry = require('../models/timeentry');
const task = require('../models/task');
const wbs = require('../models/wbs');
const userProfile = require('../models/userProfile');
// const { hasPermission } = require('../utilities/permissions');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const logger = require('../startup/logger');
const cache = require('../utilities/nodeCache')();

// Shit code included.

const projectController = function (Project) {
  const getAllProjects = async function (req, res) {
    try {
      const projects = await Project.find(
        { isArchived: { $ne: true } },
        'projectName isActive category modifiedDatetime membersModifiedDatetime inventoryModifiedDatetime',
      ).sort({ modifiedDatetime: -1 });
      res.status(200).send(projects);
    } catch (error) {
      logger.logException(error);
      res.status(404).send('Error fetching projects. Please try again.');
    }
  };

  const deleteProject = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'deleteProject'))) {
      res.status(403).send({ error: 'You are not authorized to delete projects.' });
      return;
    }
    const { projectId } = req.params;
    Project.findById(projectId, (error, record) => {
      if (error || !record || record === null || record.length === 0) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      // find if project has any time entries associated with it

      timeentry
        .find({ projectId: record._id }, '_id')
        .then((timeentries) => {
          if (timeentries.length > 0) {
            res.status(400).send({
              error:
                'This project has associated time entries and cannot be deleted. Consider inactivaing it instead.',
            });
          } else {
            const removeprojectfromprofile = userProfile
              .updateMany({}, { $pull: { projects: record._id } })
              .exec();
            const removeproject = record.remove();

            Promise.all([removeprojectfromprofile, removeproject])
              .then(() => {
                res.status(200).send({
                  message: 'Project successfully deleted and user profiles updated.',
                });
              })
              .catch((errors) => {
                res.status(400).send(errors);
              });
          }
        })
        .catch((errors) => {
          res.status(400).send(errors);
        });
    });
    // .catch((errors) => {
    //   res.status(400).send(errors);
    // });
  };

  const postProject = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'postProject'))) {
      return res.status(401).send('You are not authorized to create new projects.');
    }
  
    if (!req.body.projectName) {
      return res.status(400).send('Project Name is mandatory fields.');
    }
  
    try {
      const projectWithRepeatedName = await Project.find({
        projectName: {
          $regex: escapeRegex(req.body.projectName),
          $options: 'i',
        },
      });
      if (projectWithRepeatedName.length > 0) {
        return res.status(400).send(
          `Project Name must be unique. Another project with name ${req.body.projectName} already exists. Please note that project names are case insensitive.`,
        );
      }
  
      const _project = new Project();
      const now = new Date();
      _project.projectName = req.body.projectName;
      _project.category = req.body.projectCategory;
      _project.isActive = true;
      _project.createdDatetime = now;
      _project.modifiedDatetime = now;
  
      const savedProject = await _project.save();
      return res.status(200).send(savedProject);
    } catch (error) {
      res.status(400).send('Error creating project. Please try again.');
    }
  };

  const putProject = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'putProject'))) {
      res.status(403).send('You are not authorized to make changes in the projects.');
      return;
    }
    const { projectName, category, isActive, _id: projectId, isArchived } = req.body;
    const sameNameProejct = await Project.find({
      projectName,
      _id: { $ne: projectId },
    });
    if (sameNameProejct.length > 0) {
      res.status(400).send('This project name is already taken');
      return;
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const targetProject = await Project.findById(projectId);
      if (!targetProject) {
        res.status(400).send('No valid records found');
        return;
      }
      targetProject.projectName = projectName;
      targetProject.category = category;
      targetProject.isActive = isActive;
      targetProject.modifiedDatetime = Date.now();
      if (isArchived) {
        targetProject.isArchived = isArchived;
        // deactivate wbs within target project
        await wbs.updateMany({ projectId }, { isActive: false }, { session });
        // deactivate tasks within affected wbs
        const deactivatedwbsIds = await wbs.find({ projectId }, '_id');
        await task.updateMany(
          { wbsId: { $in: deactivatedwbsIds } },
          { isActive: false },
          { session },
        );
        // remove project from userprofiles.projects array
        await userProfile.updateMany(
          { projects: projectId },
          { $pull: { projects: projectId } },
          { session },
        );
        // deactivate timeentry for affected tasks
        await timeentry.updateMany({ projectId }, { isActive: false }, { session });
      }
      await targetProject.save({ session });
      await session.commitTransaction();
      res.status(200).send(targetProject);
    } catch (error) {
      await session.abortTransaction();
      logger.logException(error);
      res.status(400).send('Error updating project. Please try again.');
    } finally {
      session.endSession();
    }
  };

  const getProjectById = function (req, res) {
    const { projectId } = req.params;
    Project.findById(projectId, '-__v  -createdDatetime -modifiedDatetime')
      .then((results) => res.status(200).send(results))
      .catch((err) => {
        logger.logException(err);
        res.status(404).send('Error fetching project. Please try again.');
      });
  };

  const getUserProjects = async function (req, res) {
    try {
      const { userId } = req.params;
      const user = await userProfile.findById(userId, 'projects');
      if (!user) {
        res.status(400).send('Invalid user');
        return;
      }
      const { projects } = user;
      const projectList = await Project.find(
        { _id: { $in: projects }, isActive: { $ne: false } },
        '_id projectName category',
      );
      const result = projectList
        .map((p) => {
          p = p.toObject();
          p.projectId = p._id;
          delete p._id;
          return p;
        })
        .sort((p1, p2) => {
          if (p1.projectName.toLowerCase() < p2.projectName.toLowerCase()) return -1;
          if (p1.projectName.toLowerCase() > p2.projectName.toLowerCase()) return 1;
          return 0;
        });
      res.status(200).send(result);
    } catch (error) {
      logger.logException(error);
      res.status(400).send('Error fetching projects. Please try again.');
    }
  };

  const assignProjectToUsers = async function (req, res) {
    // verify requestor is administrator, projectId is passed in request params and is valid mongoose objectid, and request body contains  an array of users
    if (!(await helper.hasPermission(req.body.requestor, 'assignProjectToUsers'))) {
      res.status(403).send('You are not authorized to perform this operation');
      return;
    }
    if (
      !req.params.projectId ||
      !mongoose.Types.ObjectId.isValid(req.params.projectId) ||
      !req.body.users ||
      req.body.users.length === 0
    ) {
      res.status(400).send('Invalid request');
      return;
    }
    // verify project exists
    Project.findById(req.params.projectId)
      .then((project) => {
        if (!project || project.length === 0) {
          res.status(400).send('Invalid project');
          return;
        }
        const { users } = req.body;
        const assignlist = [];
        const unassignlist = [];

        users.forEach((element) => {
          const { userId, operation } = element;
          if (cache.hasCache(`user-${userId}`)) {
            cache.removeCache(`user-${userId}`);
          }
          if (operation === 'Assign') {
            assignlist.push(userId);
          } else {
            unassignlist.push(userId);
          }
        });

        const assignPromise = userProfile
          .updateMany({ _id: { $in: assignlist } }, { $addToSet: { projects: project._id } })
          .exec();
        const unassignPromise = userProfile
          .updateMany({ _id: { $in: unassignlist } }, { $pull: { projects: project._id } })
          .exec();

        Promise.all([assignPromise, unassignPromise])
          .then(() => {
            res.status(200).send({ result: 'Done' });
          })
          .catch((error) => {
            res.status(500).send({ error });
          });
      })
      .catch((err) => {
        logger.logException(err);
        res.status(500).send('Error fetching project. Please try again.');
      });
  };

  const getprojectMembership = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'getProjectMembers'))) {
      res.status(403).send('You are not authorized to perform this operation');
      return;
    }
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).send('Invalid request');
      return;
    }
    userProfile
      .find(
        { projects: projectId, isActive: true },
        { firstName: 1, lastName: 1, profilePic: 1 },
      )
      .then((results) => {
        console.log(results);
        res.status(200).send(results);
      })
      .catch((error) => {
        res.status(500).send(error);
      });
  };

  function escapeRegExp(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  const searchProjectMembers = async function (req, res) {
    const { projectId, query } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).send('Invalid project ID');
    }
    // Sanitize user input and escape special characters
    const sanitizedQuery = escapeRegExp(query.trim());
    // case-insensitive search
    const searchRegex = new RegExp(sanitizedQuery, 'i');
    
    try {
      const getProjMembers = await helper.hasPermission(req.body.requestor, 'getProjectMembers');
      const postTask = await helper.hasPermission(req.body.requestor, 'postTask');
      const updateTask = await helper.hasPermission(req.body.requestor, 'updateTask');
      const suggestTask = await helper.hasPermission(req.body.requestor, 'suggestTask');
      const canGetId = (getProjMembers || postTask || updateTask || suggestTask);
      
      const results = await userProfile.find({
        projects: projectId,
        $or: [
          { firstName: { $regex: searchRegex } }, 
          { lastName: { $regex: searchRegex } }
        ]
      })
      .select(`firstName lastName isActive ${canGetId ? '_id' : ''}`)
      .sort({ firstName: 1, lastName: 1 })
      .limit(30);
      res.status(200).send(results);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const getProjectsWithActiveUserCounts = async function (req, res) {
    try {
      const projects = await Project.find({ isArchived: { $ne: true } }, '_id');

      const projectIds = projects.map(project => project._id);

      const userCounts = await userProfile.aggregate([
        { $match: { projects: { $in: projectIds }, isActive: true } },
        { $unwind: '$projects' },
        { $match: { projects: { $in: projectIds } } },
        {
          $group: {
            _id: '$projects',
            activeUserCount: { $sum: 1 },
          },
        },
      ]);

      const result = userCounts.reduce((acc, curr) => {
        acc[curr._id.toString()] = curr.activeUserCount;
        return acc;
      }, {});

      res.status(200).send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching active member counts');
    }
  };

  return {
    getAllProjects,
    postProject,
    getProjectById,
    putProject,
    deleteProject,
    getUserProjects,
    assignProjectToUsers,
    getprojectMembership,
    searchProjectMembers,
    getProjectsWithActiveUserCounts,
  };
};

module.exports = projectController;