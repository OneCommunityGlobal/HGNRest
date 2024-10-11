/* eslint-disable quotes */
/* eslint-disable arrow-parens */
const mongoose = require('mongoose');
const timeentry = require('../models/timeentry');
const task = require('../models/task');
const wbs = require('../models/wbs');
const userProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const logger = require('../startup/logger');
const cache = require('../utilities/nodeCache')();

const projectController = function (Project) {
  const getAllProjects = async function (req, res) {
    try {
      const projects = await Project.find(
        { isArchived: { $ne: true } },
        'projectName isActive category modifiedDatetime membersModifiedDatetime',
      ).sort({ modifiedDatetime: -1 });
      res.status(200).send(projects);
    } catch (error) {
      logger.logException(error);
      res.status(404).send('Error fetching projects. Please try again.');
    }
  };

  const getArchivedProjects = async function (req, res) {
    try {
      const archivedProjects = await Project.find(
        { isArchived: true },
        'projectName isActive category modifiedDatetime membersModifiedDatetime isArchived',
      ).sort({ modifiedDatetime: -1 });
      res.status(200).send(archivedProjects);
    } catch (error) {
      logger.logException(error);
      res.status(404).send('Error fetching archived projects. Please try again.');
    }
  };

  const deleteProject = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'deleteProject'))) {
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
      timeentry.find({ projectId: record._id }, '_id').then((timeentries) => {
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
            .then(
              res.status(200).send({
                message: 'Project successfully deleted and user profiles updated.',
              }),
            )
            .catch((errors) => {
              res.status(400).send(errors);
            });
        }
      });
    }).catch((errors) => {
      res.status(400).send(errors);
    });
  };

  const postProject = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'postProject'))) {
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
        res
          .status(400)
          .send(
            `Project Name must be unique. Another project with name ${req.body.projectName} already exists. Please note that project names are case insensitive.`,
          );
        return;
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
      logger.logException(error);
      res.status(400).send('Error creating project. Please try again.');
    }
  };

  const putProject = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'editProject'))) {
      if (!(await hasPermission(req.body.requestor, 'putProject'))) {
        res.status(403).send('You are not authorized to make changes in the projects.');
        return;
      }
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
      targetProject.isArchived = isArchived;
      if (isArchived) {
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
      } else {
        // reactivate wbs within target project
        await wbs.updateMany({ projectId }, { isActive: true }, { session });
        // reactivate tasks within affected wbs
        const activatedwbsIds = await wbs.find({ projectId }, '_id');
        await task.updateMany({ wbsId: { $in: activatedwbsIds } }, { isActive: true }, { session });

        // readd project from userprofiles.projects array
        await userProfile.updateMany(
          { projects: { $ne: projectId } },
          { $addToSet: { projects: projectId } },
          { session },
        );
        // activate timeentry for affected tasks
        await timeentry.updateMany({ projectId }, { isActive: true }, { session });
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

    if (!(await hasPermission(req.body.requestor, 'assignProjectToUsers'))) {
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
    const now = new Date();
    // verify project exists
    Project.findByIdAndUpdate(
      req.params.projectId,
      {
        $set: { membersModifiedDatetime: now },
      },
      { new: true },
    )
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
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).send('Invalid request');
      return;
    }

    const getProjMembers = await hasPermission(req.body.requestor, 'getProjectMembers');

    // If a user has permission to post, edit, or suggest tasks, they also have the ability to assign resources to those tasks.
    // Therefore, the _id field must be included when retrieving the user profile for project members (resources).
    const postTask = await hasPermission(req.body.requestor, 'postTask');
    const updateTask = await hasPermission(req.body.requestor, 'updateTask');
    const suggestTask = await hasPermission(req.body.requestor, 'suggestTask');

    const getId = getProjMembers || postTask || updateTask || suggestTask;

    userProfile
      .find(
        { projects: projectId },
        { firstName: 1, lastName: 1, isActive: 1, profilePic: 1, _id: getId },
      )
      .sort({ firstName: 1, lastName: 1 })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => {
        res.status(500).send(error);
      });
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
    getArchivedProjects,
  };
};

module.exports = projectController;
