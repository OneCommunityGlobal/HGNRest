const UserProfile = require('../models/userProfile');
const cache = require('../utilities/nodeCache')();


const mapLocationsController = function (MapLocation) {
  const getAllLocations = async function (req, res) {

    try {
      const users = [];
      const results = await UserProfile.find({},
        '_id firstName lastName isActive location jobTitle totalTangibleHrs hoursByCategory'
      );

      results.forEach((item) => {
        if (
          (item.location?.coords.lat && item.location?.coords.lng && item.totalTangibleHrs >= 10) ||
          (item.location?.coords.lat && item.location?.coords.lng && calculateTotalHours(item.hoursByCategory) >= 10)
        ) {
          users.push(item);
        }
      });
      const modifiedUsers = users.map(item => ({
        location: item.location,
        isActive: item.isActive,
        jobTitle: item.jobTitle[0],
        _id: item._id,
        firstName: item.firstName,
        lastName: item.lastName
      }));

      const mUsers = await MapLocation.find({});
      res.status(200).send({ users: modifiedUsers, mUsers });
    } catch (err) {
      res.status(404).send(err);
    }

  };
  const deleteLocation = async function (req, res) {

    if (!req.body.requestor.role === 'Administrator' || !req.body.requestor.role === 'Owner') {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }
    const locationId = req.params.locationId

    MapLocation.findOneAndDelete({ _id: locationId })
      .then(() => res.status(200).send({ message: "The location was successfully removed!" }))
      .catch(error => res.status(500).send({ message: error || "Couldn't remove the location" }));
  };
  const putUserLocation = async function (req, res) {

    if (!req.body.requestor.role === 'Owner') {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }
    const locationData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      jobTitle: req.body.jobTitle,
      location: req.body.location,
    }
    const location = new MapLocation(locationData);

    try {
      const response = await location.save()
      if (!response) {
        throw new Error('Something went wrong during saving the location...')
      }
      res.status(200).send(response);
    } catch (err) {
      console.log(err.message)
      res.status(500).json({ message: err.message || 'Something went wrong...' });
    }
  };
  const updateUserLocation = async function (req, res) {
    if (!req.body.requestor.role === 'Owner') {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }
    const userType = req.body.type;
    const userId = req.body._id;
    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      jobTitle: req.body.jobTitle,
      location: req.body.location,
    }

    if (req.body.timeZone) {
      updateData.timeZone = req.body.timeZone
    }

    try {
      let response;
      if (userType === 'user') {
        response = await UserProfile.findOneAndUpdate({ _id: userId }, { $set: { ...updateData, jobTitle: [updateData.jobTitle] } }, { new: true });
        cache.removeCache('allusers')
        cache.removeCache(`user-${userId}`);

        cache.setCache(`user-${userId}`, JSON.stringify(response));
      } else {
        response = await MapLocation.findOneAndUpdate({ _id: userId }, { $set: updateData }, { new: true })
      }

      if (!response) {
        throw new Error('Something went wrong during saving the location...')
      }
      const newData = {
        firstName: response.firstName,
        lastName: response.lastName,
        jobTitle: response.jobTitle,
        location: response.location,
        _id: response._id,
        type: userType
      }

      res.status(200).send(newData);
    } catch (err) {
      console.log(err.message)
      res.status(500).json({ message: err.message || 'Something went wrong...' });
    }
  };

  function calculateTotalHours(hoursByCategory) {
    let hours = 0;
    Object.keys(hoursByCategory).forEach((x) => {
      hours += hoursByCategory[x];
    });
    return hours;
  }
  
  return {
    getAllLocations,
    deleteLocation,
    putUserLocation,
    updateUserLocation
  };
};

module.exports = mapLocationsController;
