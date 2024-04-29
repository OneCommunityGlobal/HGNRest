// const mongoose = require('mongoose');
// const userProfile = require('../models/userProfile');
// const hasPermission = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const cacheClosure = require('../utilities/nodeCache');

const informationController = function (Information) {
  const cache = cacheClosure();
  const getInformations = function (req, res) {
    // return all informations if cache is available
    if (cache.getCache('informations')) {
      res.status(200).send(cache.getCache('informations'));
      return;
    }
    Information.find({}, 'infoName infoContent visibility')
      .then((results) => {
        // cache results
        cache.setCache('informations', results);
        res.status(200).send(results);
      })
      /* eslint-disable no-unused-vars */
      .catch((error) =>
        res.status(500).send({ error: 'Error when finding informations and any information' }),
      );
  };

  const addInformation = function (req, res) {
    try {
      Information.find({
        infoName: { $regex: escapeRegex(req.body.infoName), $options: 'i' },
      }).then((result) => {
        if (result.length > 0) {
          res.status(400).send({
            error: `Info Name must be unique. Another infoName with name ${result[0].infoName} already exists. Please note that info names are case insensitive`,
          });
          return;
        }
        const _info = new Information();
        _info.infoName = req.body.infoName;
        _info.infoContent = req.body.infoContent || 'Unspecified';
        _info.visibility = req.body.visibility || '0';
        _info
          .save()
          .then((newInformation) => {
            // remove cache if cache is available
            if (cache.getCache('informations')) {
              cache.removeCache('informations');
              return;
            }
            res.status(201).send(newInformation);
          })
          .catch((error) => res.status(400).send(error));
      });
    } catch (error) {
      res.status(500).send({ error: 'Error when finding infoName' });
    }
  };

  const deleteInformation = function (req, res) {
    Information.findOneAndDelete({ _id: req.params.id })
      .then((deletedInformation) => {
        // remove cache if cache is available
        if (cache.hasCache('informations')) {
          cache.removeCache('informations');
          return;
        }
        res.status(200).send(deletedInformation);
      })
      .catch((error) =>
        res.status(400).send(new Error('Error when finding and deleting information by Id')),
      );
  };

  // Update existing information by id
  const updateInformation = function (req, res) {
    Information.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true })
      .then((updatedInformation) => {
        // remove cache if cache is available
        if (cache.hasCache('informations')) {
          cache.removeCache('informations');
          return;
        }
        res.status(200).send(updatedInformation);
      })
      .catch((error) =>
        res.status(400).send(new Error('Error when finding and updating information by Id')),
      );
  };

  return {
    getInformations,
    addInformation,
    updateInformation,
    deleteInformation,
  };
};

module.exports = informationController;
