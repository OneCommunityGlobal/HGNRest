const express = require('express');

const router = function (mapLocations) {
    const controller = require('../controllers/mapLocationsController')(mapLocations);

    const mapRouter = express.Router();

    mapRouter.route('/mapLocations')
        .get(controller.getAllLocations)
        .put(controller.putUserLocation);

    mapRouter.route('/mapLocations/:locationId')
        .delete(controller.deleteLocation)

    return mapRouter;
};

module.exports = router;
