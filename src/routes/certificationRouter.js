const express = require('express');

const routes = function () {
  const controller = require('../controllers/certificationController')();
  const CertificationRouter = express.Router();

  CertificationRouter.route('/certifications').get(controller.getAllCertifications);

  CertificationRouter.route('/educators/certifications').get(
    controller.getAllEducatorCertifications,
  );

  CertificationRouter.route('/educators/:educatorId/certifications').post(
    controller.assignOrUpdateCertification,
  );

  return CertificationRouter;
};

module.exports = routes;
