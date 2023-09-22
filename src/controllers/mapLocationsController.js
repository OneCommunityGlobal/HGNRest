const mongoose = require('mongoose');
const mapLocation = require('../models/mapLocation');
const { hasPermission } = require('../utilities/permissions');

const mapLocationsController = function () {
  const getAllLocations = function (req, res) {
    console.log('controller:')
    console.log(req.body)

    mapLocation.find({})
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));
  };
  const deleteLocation = async function (req, res) {
    if (!await hasPermission(req.body.requestor.role, 'deleteTeam')) {
      res.status(403).send({ error: 'You are not authorized to delete teams.' });
      return;
    }
    const { teamId } = req.params;
    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      const removeteamfromprofile = userProfile.updateMany({}, { $pull: { teams: record._id } }).exec();
      const deleteteam = record.remove();

      Promise.all([removeteamfromprofile, deleteteam])
        .then(res.status(200).send({ message: ' Team successfully deleted and user profiles updated' }))
        .catch((errors) => {
          res.status(400).send(errors);
        });
    }).catch((error) => {
      res.status(400).send(error);
    });
  };
  const putUserLocation = async function (req, res) {
    if (!await hasPermission(req.body.requestor.role, 'putTeam')) {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }

    const { teamId } = req.params;

    Team.findById(teamId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }
      record.teamName = req.body.teamName;
      record.isActive = req.body.isActive;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record
        .save()
        .then(results => res.status(201).send(results._id))
        .catch(errors => res.status(400).send(errors));
    });
  };

  return {
    getAllLocations,
    deleteLocation,
    putUserLocation
  };
};

module.exports = mapLocationsController;
