const express = require('express');


const routes = function (information) {
  const controller = require('../controllers/informationController')(information);
  const informationRouter = express.Router();


  informationRouter.route('/informations')
    .get(controller.getInformations)
    .post(controller.addInformation);
  informationRouter.route('/informations/:id')
    .put(controller.updateInformation)
    .delete(controller.deleteInformation);

  return informationRouter;
};

module.exports = routes;
