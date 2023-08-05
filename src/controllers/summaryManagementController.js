const mongoose = require("mongoose");
const SummaryGroup = require("../models/summaryGroup");

const summaryManagementController = function (summaryGroup) {
  const postNewSummaryGroup = function (req, res) {
    const summaryGroup = new SummaryGroup();

    summaryGroup.summaryGroupName = req.body.summaryGroupName;
    summaryGroup.isActive = req.body.isActive;
    summaryGroup.createdDatetime = Date.now();
    summaryGroup.modifiedDatetime = Date.now();

    summaryGroup
      .save()
      .then((results) => res.send(results).status(200))
      .catch((error) => res.send(error).status(500));
  };
  const getAllSummaryGroup = function (req, res) {
    summaryGroup
      .find({})
      .sort({ summaryGroupName: 1 })
      .then((results) => res.send(results).status(200))
      .catch((error) => res.send(error).status(404));
  };
  const deleteSummaryGroup = function (req, res) {
    const { summaryGroupId } = req.params;
    summaryGroup
      .findById(summaryGroupId, (error, record) => {
        if (error || record === null) {
          res.status(400).send({ error: "No valid records found" });
          return;
        }
        const deleteSummaryGroup = record.remove();
        Promise.all(deleteSummaryGroup)
          .then(() =>
            res.status(200).send({
              message: " Team successfully deleted and user profiles updated",
            })
          )
          .catch((errors) => {
            res.status(400).send(errors);
          });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };
  const putSummaryGroup = function (req, res) {
    /* if (!hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    } */

    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send("No valid records found");
        return;
      }
      record.summaryGroupName = req.body.summaryGroupName;
      record.isActive = req.body.isActive;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record
        .save()
        .then((results) => res.status(201).send(results._id))
        .catch((errors) => res.status(400).send(errors));
    });
  };
  const addTeamMemberToSummaryGroup = function (req, res) {
    /* if (!hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    } */

    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send("No valid records found");
        return;
      }

      const teamMember = {
        _id: req.body._id,
        fullName: req.body.fullName,
        role: req.body.role,
      };

      record.teamMembers.push(teamMember);
      record
        .save()
        .then((results) => res.status(201).send(results._id))
        .catch((errors) => res.status(400).send(errors));
    });
  };

  const getTeamMembersBySummaryGroupId = function (req, res) {
    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, summaryGroup) => {
      if (error || !summaryGroup) {
        return res.status(400).send("No valid records found");
      }

      const { teamMembers } = summaryGroup;
      res.status(200).json({ teamMembers });
    });
  };
  const deleteTeamMemberToSummaryGroup = function (req, res) {
    const { summaryGroupId, userId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: "No valid records found" });
        return;
      }
      const teamMemberObjectId = mongoose.Types.ObjectId(userId);
      const updatedTeamMembers = record.teamMembers.filter(
        (teamMember) =>
          teamMember._id.toString() !== teamMemberObjectId.toString()
      );

      record.teamMembers = updatedTeamMembers;
      record
        .save()
        .then((results) => res.status(204).send())
        .catch((errors) => res.status(400).send(errors));
    });
  };
  const addSummaryReceiversToSummaryGroup = function (req, res) {
    /* if (!hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    } */

    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send("No valid records found");
        return;
      }

      const summaryReceiver = {
        _id: req.body._id,
        fullName: req.body.fullName,
        role: req.body.role,
        email: req.body.email,
      };

      record.summaryReceivers.push(summaryReceiver);
      record
        .save()
        .then((results) => res.status(201).send(results._id))
        .catch((errors) => res.status(400).send(errors));
    });
  };

  const getSummaryReceiversBySummaryGroupId = function (req, res) {
    const { summaryGroupId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, summaryGroup) => {
      if (error || !summaryGroup) {
        return res.status(400).send("No valid records found");
      }

      const { summaryReceivers } = summaryGroup;
      res.status(200).json({ summaryReceivers });
    });
  };

  const deleteSummaryReceiverToSummaryGroup = function (req, res) {
    const { summaryGroupId, userId } = req.params;

    summaryGroup.findById(summaryGroupId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: "No valid records found" });
        return;
      }

      const summaryReceiverObjectId = mongoose.Types.ObjectId(userId);
      const updatedsummaryReceivers = record.summaryReceivers.filter(
        (summaryReceiver) =>
          summaryReceiver._id.toString() !== summaryReceiverObjectId.toString()
      );

      record.summaryReceivers = updatedsummaryReceivers;

      record
        .save()
        .then((results) => res.status(204).send())
        .catch((errors) => res.status(400).send(errors));
    });
  };
  return {
    postNewSummaryGroup,
    getAllSummaryGroup,
    deleteSummaryGroup,
    putSummaryGroup,
    getTeamMembersBySummaryGroupId,
    addTeamMemberToSummaryGroup,
    deleteTeamMemberToSummaryGroup,
    addSummaryReceiversToSummaryGroup,
    getSummaryReceiversBySummaryGroupId,
    deleteSummaryReceiverToSummaryGroup,
  };
};

module.exports = summaryManagementController;
