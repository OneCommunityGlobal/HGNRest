/* eslint-disable quotes */
/* eslint-disable no-unused-vars */
const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const Project = require('../models/project');
const Task = require('../models/task');

const wbsController = function (WBS) {
  const getAllWBS = function (req, res) {
    WBS.find(
      { projectId: { $in: [req.params.projectId] }, isActive: { $ne: false } },
      'wbsName isActive modifiedDatetime',
    )
      .sort({ modifiedDatetime: -1 })
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const postWBS = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'postWbs'))) {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.wbsName || !req.body.isActive) {
      res
        .status(400)
        // eslint-disable-next-line quotes
        .send({ error: 'WBS Name and active status are mandatory fields' });
      return;
    }

    const _wbs = new WBS();
    _wbs.projectId = req.params.id;
    _wbs.wbsName = req.body.wbsName;
    _wbs.isActive = req.body.isActive;
    _wbs.createdDatetime = Date.now();
    _wbs.modifiedDatetime = Date.now();

    // adding a new wbs should change the modified date of parent project
    const saveProject = Project.findById(req.params.id).then((currentProject) => {
      currentProject.modifiedDatetime = Date.now();
      return currentProject.save();
    });

    _wbs
      .save()
      .then((results) => res.status(201).send(results))
      .catch((error) => res.status(500).send({ error }));
  };

  const deleteWBS = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'deleteWbs'))) {
      res.status(403).send({ error: 'You are  not authorized to delete projects.' });
      return;
    }
    const { id } = req.params;
    WBS.findById(id, (error, record) => {
      if (error || !record || record === null || record.length === 0) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      const removeWBS = record.remove();

      Promise.all([removeWBS])
        .then(res.status(200).send({ message: ' WBS successfully deleted' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    });
  };

  const getWBS = function (req, res) {
    WBS.find({ isActive: { $ne: false } })
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(500).send({ error }));
  };

  const getWBSById = function (req, res) {
    const wbsId = req.params.id;
    WBS.findById(wbsId)
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => res.status(404).send(error));
  };

  return {
    postWBS,
    deleteWBS,
    getAllWBS,
    getWBS,
    getWBSById,
  };
};

module.exports = wbsController;
