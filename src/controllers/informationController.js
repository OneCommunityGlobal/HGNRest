const mongoose = require('mongoose');
// const userProfile = require('../models/userProfile');
// const hasPermission = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');


const informationController = function (Information) {
  const getInformations = function (req, res) {
    Information.find({}, 'infoName infoContent')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };


  const addInformation = function (req, res) {
    Information.create(req.body)
      .then(newInformation => res.status(201).send(newInformation))
      .catch(error => res.status(400).send(error));

      Information.find({ infoName: { $regex: escapeRegex(req.body.infoName), $options: 'i' } })
      .then((result) => {
        if (result.length > 0) {
          res.status(400).send({ error: `Info Name must be unique. Another project with name ${result.infoName} already exists. Please note that info names are case insensitive` });
          return;
        }
        const _info = new Information();
        _info.infoName = req.body.infoName;
        _info.infoContent = req.body.infoContent || 'Unspecified';
        _info.save()
          .then(results => res.status(201).send(results))
          .catch(error => res.status(500).send({ error }));
      });
  };
  const deleteInformation = function (req, res) {
    Information.findOneAndDelete({ _id: req.params.id })
      .then(deletedInformation => res.status(200).send(deletedInformation))
      .catch(error => res.status(400).send(error));
  };
  
  // Update existing information by id
  const updateInformation = function (req, res) {
    Information.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true })
      .then(updatedInformation => res.status(200).send(updatedInformation))
      .catch(error => res.status(400).send(error));
  };

  return {
    getInformations,
    addInformation,
    updateInformation,
    deleteInformation,
  };
};


module.exports = informationController;
