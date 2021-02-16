const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');

const badgeController = function (Badge) {
  const getAllBadges = function (req, res) {
    const AuthorizedRolesToView = ['Administrator'];
    const isRequestorAuthorized = !!AuthorizedRolesToView.includes(
      req.body.requestor.role,
    );

    if (!isRequestorAuthorized) {
      res.status(403).send('You are not authorized to view all badge data.');
      return;
    }

    Badge.find(
      {},
      'badgeName imageUrl category project ranking description',
    ).populate({
      path: 'project',
      select: '_id projectName',
    })
      .sort({
        badgeName: 1,
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const assignBadges = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send('You are not authorized to assign badges.');
      return;
    }

    const userToBeAssigned = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userToBeAssigned, (error, record) => {
      if (error || record === null) {
        res.status(400).send('Can not find the user to be assigned.');
        return;
      }
      record.badgeCollection = req.body.badgeCollection;

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(errors => res.status(500).send(errors));
    });
  };

  const postBadge = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new badges.' });
      return;
    }

    Badge.find({ badgeName: { $regex: req.body.badgeName, $options: 'i' } })
      .then((result) => {
        if (result.length > 0) {
          res.status(400).send({ error: `Another badge with name ${result[0].badgeName} already exists` });
          return;
        }
        const badge = new Badge();

        badge.badgeName = req.body.badgeName;
        badge.category = req.body.category;
        badge.project = req.body.project;
        badge.imageUrl = req.body.imageUrl;
        badge.ranking = req.body.ranking;
        badge.description = req.body.description;

        badge.save()
          .then(results => res.status(201).send(results))
          .catch(errors => res.status(500).send(errors));
      });
  };

  return {
    getAllBadges,
    assignBadges,
    postBadge,
  };
};

module.exports = badgeController;
