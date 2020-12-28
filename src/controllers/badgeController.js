const mongoose = require('mongoose');
const Badge = require('../models/badge');
const UserProfile = require('../models/userProfile');

const badgeController = function (Badge) {
  const getAllBadges = function (req, res) {
    const AuthorizedRolesToView = ['Administrator'];

    const userId = mongoose.Types.ObjectId(req.params.userId);

    UserProfile.findById(userId, 'role')
      .then((user) => {
        const isRequestorAuthorized = !!AuthorizedRolesToView.includes(
          user.role,
        );

        if (!isRequestorAuthorized) {
          res.status(403).send('You are not authorized to view all badge data');
        }
      })
      .catch((error) => {
        res.status(404).send(error);
      });

    Badge.find(
      {},
      'badgeName imageUrl',
    )
      .sort({
        badgeName: 1,
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  return {
    getAllBadges,
  };
};

module.exports = badgeController;
