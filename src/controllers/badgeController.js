const moment = require('moment-timezone');
const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const cache = require('../utilities/nodeCache')();
const logger = require('../startup/logger');

const badgeController = function (Badge) {
  /**
   * getAllBadges handles badges retrieval.
   * @param {Object} req - Request object.
   * @returns {Array<Object>} List containing badge records.
   */
  const getAllBadges = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'seeBadges'))) {
      res.status(403).send('You are not authorized to view all badge data.');
      return;
    }
    // Add cache to reduce database query and optimize performance
    if (cache.hasCache('allBadges')) {
      res.status(200).send(cache.getCache('allBadges'));
      return;
    }

    Badge.find(
      {},
      'badgeName type multiple weeks months totalHrs people imageUrl category project ranking description showReport',
    )
      .populate({
        path: 'project',
        select: '_id projectName',
      })
      .sort({
        ranking: 1,
        badgeName: 1,
      })
      .then((results) => {
        cache.setCache('allBadges', results);
        res.status(200).send(results);
      })
      .catch(error => res.status(500).send(error));
  };

  /**
   * Updated Date: 12/06/2023
   * Updated By: Shengwei
   * Function added:
   * - Added data validation for earned date and badge count mismatch.
   * - Added fillEarnedDateToMatchCount function to resolve earned date and badge count mismatch.
   * - Refactored data validation for duplicate badge id.
   * - Added data validation for badge count should greater than 0.
   * - Added formatDate function to format date to MMM-DD-YY.
   */

  const formatDate = () => {
    const currentDate = new Date(Date.now());
    return moment(currentDate).tz('America/Los_Angeles').format('MMM-DD-YY');
  };

  const fillEarnedDateToMatchCount = (earnedDate, count) => {
    const result = [...earnedDate];
    while (result.length < count) {
      result.push(formatDate());
    }
    return result;
  };

  const assignBadges = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'assignBadges'))) {
      res.status(403).send('You are not authorized to assign badges.');
      return;
    }

    const userToBeAssigned = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userToBeAssigned, (error, record) => {
      if (error || record === null) {
        res.status(400).send('Can not find the user to be assigned.');
        return;
      }
      const badgeCounts = {};
      let newBadgeCollection = [];
      // This line is using the forEach function to group badges in the badgeCollection
      // array in the request body.
      // Validation: No duplicate badge id;
      try {
        newBadgeCollection = req.body.badgeCollection.map((element) => {
          if (badgeCounts[element.badge]) {
            throw new Error('Duplicate badges sent in.');
            // res.status(500).send('Duplicate badges sent in.');
            // return;
          }
          badgeCounts[element.badge] = element.count;
          // Validation: count should be greater than 0
          if (element.count < 1) {
            throw new Error('Badge count should be greater than 0.');
          }
          return element;
        });
      } catch (err) {
        res
          .status(500)
          .send(`Internal Error: Badge Collection. ${err.message}`);
        return;
      }
      record.badgeCollection = newBadgeCollection;

      if (cache.hasCache(`user-${userToBeAssigned}`)) {
        cache.removeCache(`user-${userToBeAssigned}`);
      }
      // Save Updated User Profile
      record
        .save()
        .then((result) => {
          // TO-DO - add user back to cache. For some reason, the saved records lead to badge img loading failure in frontend.
          // cache.setCache(`user-${userToBeAssigned}`, JSON.stringify(result));
          res.status(201).send(result._id);
        })
        .catch((err) => {
          logger.logException(err);
          res.status(500).send('Internal Error: Unable to save the record.');
        });
    });
  };

  const postBadge = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'createBadges'))) {
      res
        .status(403)
        .send({ error: 'You are not authorized to create new badges.' });
      return;
    }

    Badge.find({
      badgeName: { $regex: escapeRegex(req.body.badgeName), $options: 'i' },
    }).then((result) => {
      if (result.length > 0) {
        res.status(400).send({
          error: `Another badge with name ${result[0].badgeName} already exists. Sorry, but badge names should be like snowflakes, no two should be the same. Please choose a different name for this badge so it can be proudly unique.`,
        });
        return;
      }
      const badge = new Badge();

      badge.badgeName = req.body.badgeName;
      badge.category = req.body.category;
      badge.type = req.body.type;
      badge.multiple = req.body.multiple;
      badge.totalHrs = req.body.totalHrs;
      badge.weeks = req.body.weeks;
      badge.months = req.body.months;
      badge.people = req.body.people;
      badge.project = req.body.project;
      badge.imageUrl = req.body.imageUrl;
      badge.ranking = req.body.ranking;
      badge.description = req.body.description;
      badge.showReport = req.body.showReport;

      badge
        .save()
        .then((results) => {
          // remove cache after new badge is saved
          if (cache.getCache('allBadges')) {
            cache.removeCache('allBadges');
          }
          res.status(201).send(results);
        })
        .catch(errors => res.status(500).send(errors));
    });
  };

  const deleteBadge = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'deleteBadges'))) {
      res
        .status(403)
        .send({ error: 'You are not authorized to delete badges.' });
      return;
    }
    const { badgeId } = req.params;
    Badge.findById(badgeId, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      const removeBadgeFromProfile = UserProfile.updateMany(
        {},
        { $pull: { badgeCollection: { badge: record._id } } },
      ).exec();
      const deleteRecord = record.remove();

      Promise.all([removeBadgeFromProfile, deleteRecord])
        .then(() => {
          // remove cache after new badge is deleted
          if (cache.getCache('allBadges')) {
            cache.removeCache('allBadges');
          }
          res.status(200).send({
            message: 'Badge successfully deleted and user profiles updated',
          });
        })
        .catch((errors) => {
          res.status(500).send(errors);
        });
    }).catch((error) => {
      res.status(500).send(error);
    });
  };

  const putBadge = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'updateBadges'))) {
      res
        .status(403)
        .send({ error: 'You are not authorized to update badges.' });
      return;
    }
    const { badgeId } = req.params;
    const imageUrl = null;

    // If has req.body.file than upload image and insert that url
    // into imageUrl
    if (req.body.file) {
      // call imageUpload function
      // store onto Azure and return url
    }

    const data = {
      badgeName: req.body.name || req.body.badgeName,
      description: req.body.description,
      type: req.body.type,
      multiple: req.body.multiple,
      totalHrs: req.body.totalHrs,
      people: req.body.people,
      category: req.body.category,
      months: req.body.months,
      weeks: req.body.weeks,
      project: req.body.project,
      imageUrl: imageUrl || req.body.imageUrl || req.body.imageURL,
      ranking: req.body.ranking,
      showReport: req.body.showReport,
    };

    Badge.findByIdAndUpdate(badgeId, data, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      // remove cache after new badge is updated
      if (cache.getCache('allBadges')) {
        cache.removeCache('allBadges');
      }
      res.status(200).send({ message: 'Badge successfully updated' });
    });
  };

  return {
    getAllBadges,
    assignBadges,
    postBadge,
    deleteBadge,
    putBadge,
  };
};

module.exports = badgeController;
