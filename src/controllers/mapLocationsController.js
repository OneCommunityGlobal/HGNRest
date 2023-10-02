const mapLocationsController = function (mapLocation) {
  const getAllLocations = function (req, res) {

    mapLocation.find({})
      .then(results =>
        res.send(results).status(200)
      )
      .catch(error => 
        res.send(error).status(404));
  };
  const deleteLocation = async function (req, res) {

    if (!req.body.requestor.role === 'Administrator' || !req.body.requestor.role === 'Owner') {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }
  };
  const putUserLocation = async function (req, res) {

    if (!req.body.requestor.role === 'Administrator' || !req.body.requestor.role === 'Owner') {
      res.status(403).send('You are not authorized to make changes in the teams.');
      return;
    }
    const locationData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      jobTitle: req.body.jobTitle,
      location: req.body.location,
    }
    const location = new mapLocation(locationData);

    try {
      const response = await location.save()
      if(!response) {
        throw new Error('Something went wrong during saving the location...')
      }
      res.status(200).send(response);
    } catch (err) {
      console.log(err.message)
      res.status(500).json({message: err.message || 'Something went wrong...'});
    }
  };

  return {
    getAllLocations,
    deleteLocation,
    putUserLocation
  };
};

module.exports = mapLocationsController;
