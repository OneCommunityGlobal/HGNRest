const mongoose = require('mongoose');
const SummaryGroup = require('../models/summaryGroup');

const summaryManagementController = function (summaryGroup) {
  const postNewSummaryGroup = function (req, res) {
    const summaryGroup = new SummaryGroup();

    summaryGroup.summaryGroupName = req.body.summaryGroupName;
    summaryGroup.isActive = req.body.isActive;
    summaryGroup.createdDatetime = Date.now();
    summaryGroup.modifiedDatetime = Date.now();

    summaryGroup
      .save()
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(500));
  };
  const getAllSummaryGroup = function (req, res) {
    summaryGroup.find({})
      .sort({ summaryGroupName: 1 })
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));
  };
  const deleteSummaryGroup = function (req, res) {
    const { summaryGroupId } = req.params;
    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      const deleteSummaryGroup = record.remove();
      Promise.all(deleteSummaryGroup)
        .then(res.status(200).send({ message: ' Team successfully deleted and user profiles updated' }))
        .catch((errors) => { res.status(400).send(errors); });
    })
      .catch((error) => { res.status(400).send(error); });
  };
  const putSummaryGroup = function (req, res) {
    /* if (!hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    } */

    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }
      record.summaryGroupName = req.body.summaryGroupName;
      record.isActive = req.body.isActive;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(errors => res.status(400).send(errors));
    });
  };

  return {
    postNewSummaryGroup,
    getAllSummaryGroup,
    deleteSummaryGroup,
    putSummaryGroup,
  };
};

module.exports = summaryManagementController;
