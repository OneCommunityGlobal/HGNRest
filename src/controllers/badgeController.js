const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const escapeRegex = require('../utilities/escapeRegex');
const cacheClosure = require('../utilities/nodeCache');
const userHelper = require('../helpers/userHelper')();

const badgeController = function (Badge) {
  /**
   * getAllBadges handles badges retrieval.
   * @param {Object} req - Request object.
   * @returns {Array<Object>} List containing badge records.
   */
  const cache = cacheClosure();

  const awardBadgesTest = async function (req, res) {
    await userHelper.awardNewBadges();
    res.status(200).send('Badges awarded');
  };

  const updateBadgeUsers = async function (req, res) {
    console.log('Assigning Users to Badges');

    try {
      // First make sure all badges have users array
      await Badge.updateMany({ users: { $exists: false } }, { $set: { users: [] } });

      // Get all user profiles with badges
      const userProfiles = await UserProfile.find({
        'badgeCollection.0': { $exists: true },
      }).select('_id badgeCollection');

      // Filter out any null badge items and validate badge IDs
      const updatePromises = userProfiles.map((profile) =>
        Promise.all(
          profile.badgeCollection
            .filter((badgeItem) => badgeItem && badgeItem.badge) // Filter out null items
            .map((badgeItem) =>
              Badge.findByIdAndUpdate(badgeItem.badge, {
                $addToSet: {
                  users: {
                    userId: profile._id,
                  },
                },
              }).catch((err) =>
                console.error(`Error updating badge ${badgeItem.badge}: ${err.message}`),
              ),
            ),
        ),
      );

      await Promise.all(updatePromises);

      // Clear cache
      if (cache.hasCache('allBadges')) {
        cache.removeCache('allBadges');
      }

      const totalUpdates = userProfiles.reduce(
        (sum, profile) =>
          sum + (profile.badgeCollection?.filter((item) => item && item.badge)?.length || 0),
        0,
      );

      res.status(200).send({
        message: `Successfully processed ${totalUpdates} badge-user associations`,
        processedUsers: userProfiles.length,
      });
    } catch (error) {
      console.error('Full error:', error);
      res.status(500).send({
        error: 'Error updating badge users',
        details: error.message,
      });
    }
  };

  const updateBadgesWithUsers = async function (req, res) {
    console.log('Updating Badges');

    try {
      // Find badges that don't have users field
      const badgesToUpdate = await Badge.find({
        users: { $exists: false },
      });

      if (badgesToUpdate.length === 0) {
        return res.status(200).send({ message: 'No badges need updating' });
      }

      // Update all matching badges with empty users array
      await Badge.updateMany({ users: { $exists: false } }, { $set: { users: [] } });

      // Clear cache since badges were updated
      if (cache.hasCache('allBadges')) {
        cache.removeCache('allBadges');
      }

      res.status(200).send({
        message: `Successfully updated ${badgesToUpdate.length} badges with users array`,
        updatedBadges: badgesToUpdate,
      });
    } catch (error) {
      res.status(500).send({
        error: 'Error updating badges',
        details: error.message,
      });
    }
  };

  // const getBadge = async function (req, res) {
  //   const { badgeId } = req.params;

  //   try {
  //     const badge = await Badge.findById(badgeId)
  //       .populate({
  //         path: 'project',
  //         select: '_id projectName',
  //       })
  //       .populate({
  //         path: 'users.userId',
  //         select: '_id',
  //       });

  //     if (!badge) {
  //       return res.status(404).send({ error: 'Badge not found' });
  //     }

  //     res.status(200).send(badge);
  //   } catch (error) {
  //     res.status(500).send({ error: error.message });
  //   }
  // };

  const getAllBadges = async function (req, res) {
    console.log(req.body.requestor);

    // Check permissions
    if (
      !(await helper.hasPermission(req.body.requestor, 'seeBadges')) &&
      !(await helper.hasPermission(req.body.requestor, 'assignBadges')) &&
      !(await helper.hasPermission(req.body.requestor, 'createBadges')) &&
      !(await helper.hasPermission(req.body.requestor, 'updateBadges')) &&
      !(await helper.hasPermission(req.body.requestor, 'deleteBadges'))
    ) {
      console.log('User not authorized');
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
      'badgeName type multiple weeks months totalHrs people imageUrl category project ranking description showReport users',
    )
      .populate({
        path: 'project',
        select: '_id projectName',
      })
      .populate({
        path: 'users.userId',
        select: '_id username firstName lastName', // Populate firstName and profileName
      })
      .sort({
        ranking: 1,
        badgeName: 1,
      })
      .then((results) => {
        cache.setCache('allBadges', results);
        res.status(200).send(results);
      })
      .catch((error) => res.status(500).send(error));
  };

  /**
   * Updated Date: 12/17/2023
   * Updated By: Roberto
   * Function added:
   * - Refactored data validation for duplicate badge id.
   * - Added data validation for badge count should greater than 0.
   * - Added logic to combine duplicate badges into one with updated properties.
   *
   * Updated Date: 04/05/2024
   * Updated By: Abi
   * Function added:
   * - Refactored method to utilize async await syntax to make the code more testable.
   */

  const assignBadges = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'assignBadges'))) {
      res.status(403).send('You are not authorized to assign badges.');
      return;
    }

    const userToBeAssigned = mongoose.Types.ObjectId(req.params.userId);

    try {
      const record = await UserProfile.findById(userToBeAssigned);
      if (record === null) {
        res.status(400).send('Can not find the user to be assigned.');
        return;
      }
      let totalNewBadges = 0;
      const existingBadges = {};
      if (record.badgeCollection && Array.isArray(record.badgeCollection)) {
        record.badgeCollection.forEach((badgeItem) => {
          existingBadges[badgeItem.badge] = badgeItem.count;
        });
      }

      const badgeGroups = req.body.badgeCollection.reduce((grouped, item) => {
        const { badge } = item;

        if (typeof item.count !== 'number') {
          item.count = Number(item.count);
          if (Number.isNaN(item.count)) {
            return grouped;
          }
        }
        // if count is 0, skip
        if (item.count === 0) {
          return grouped;
        }

        if (!grouped[badge]) {
          // If the badge is not in the grouped object, add a new entry
          grouped[badge] = {
            count: item.count,
            lastModified: item.lastModified ? item.lastModified : Date.now(),
            featured: item.featured || false,
            earnedDate: item.earnedDate,
          };
        } else {
          // If the badge is already in the grouped object, update properties
          grouped[badge].count += item.count;
          grouped[badge].lastModified = Date.now();
          grouped[badge].featured = grouped[badge].featured || item.featured || false;

          // Combine and sort earnedDate arrays
          if (Array.isArray(item.earnedDate)) {
            const combinedEarnedDate = [...grouped[badge].earnedDate, ...item.earnedDate];
            const timestampArray = combinedEarnedDate.map((date) => new Date(date).getTime());
            timestampArray.sort((a, b) => a - b);
            grouped[badge].earnedDate = timestampArray.map((timestamp) =>
              new Date(timestamp)
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                .replace(/ /g, '-')
                .replace(',', ''),
            );
          }
        }
        if (existingBadges[badge]) {
          totalNewBadges += Math.max(0, item.count - existingBadges[badge]);
        } else {
          totalNewBadges += item.count;
        }

        return grouped;
      }, {});

      // Convert badgeGroups object to array
      const badgeGroupsArray = Object.entries(badgeGroups).map(([badge, data]) => ({
        badge,
        count: data.count,
        lastModified: data.lastModified,
        featured: data.featured,
        earnedDate: data.earnedDate,
      }));

      record.badgeCollection = badgeGroupsArray;
      record.badgeCount += totalNewBadges;

      if (cache.hasCache(`user-${userToBeAssigned}`)) {
        cache.removeCache(`user-${userToBeAssigned}`);
      }

      const results = await record.save();
      res.status(201).send(results._id);
    } catch (err) {
      res.status(500).send(`Internal Error: Badge Collection. ${err.message}`);
    }
  };

  const postBadge = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'createBadges'))) {
      res.status(403).send({ error: 'You are not authorized to create new badges.' });
      return;
    }

    try {
      const result = await Badge.find({
        badgeName: { $regex: escapeRegex(req.body.badgeName), $options: 'i' },
      });

      if (result.length > 0) {
        res.status(400).send({
          error: `Another badge with name ${result[0].badgeName} already exists...`,
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
      badge.users = []; // Initialize empty users array

      const newBadge = await badge.save();

      if (cache.getCache('allBadges')) {
        cache.removeCache('allBadges');
      }
      res.status(201).send(newBadge);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const deleteBadge = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'deleteBadges'))) {
      res.status(403).send({ error: 'You are not authorized to delete badges.' });
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
    });
    // .catch((error) => {
    //   res.status(500).send(error);
    // });
  };

  const putBadge = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'updateBadges'))) {
      res.status(403).send({ error: 'You are not authorized to update badges.' });
      return;
    }
    const { badgeId } = req.params;
    const imageUrl = null;

    if (!req.body || Object.keys(req.body).length <= 1) {
      // Call updateBadgesWithUsers if no update data provided
      return updateBadgesWithUsers(req, res);
    }

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

  const getBadgeCount = async function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userId, (error, record) => {
      // Check for errors or if user profile doesn't exist
      if (error || record === null) {
        res.sendStatus(404).send('Can not find the user to be assigned.');
        return;
      }
      // Return badge count from user profile
      res.status(200).send({ count: record.badgeCount });
    });
  };

  const putBadgecount = async function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('Can not find the user to be assigned.');
        return;
      }
      record.badgeCount = 1;

      record
        .save()
        .then((results) => res.status(201).send(results._id))
        .catch((err) => {
          res.status(500).send(err);
        });
    });
  };

  const resetBadgecount = async function (req, res) {
    const userId = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('Can not find the user to be assigned.');
        return;
      }
      record.badgeCount = 0;

      record.save();
      res.status(201).send({ count: record.badgeCount });
    });
  };

  return {
    awardBadgesTest,
    // getBadge,
    getAllBadges,
    assignBadges,
    postBadge,
    deleteBadge,
    putBadge,
    getBadgeCount,
    putBadgecount,
    resetBadgecount,
    updateBadgesWithUsers,
    updateBadgeUsers,
  };
};

module.exports = badgeController;
