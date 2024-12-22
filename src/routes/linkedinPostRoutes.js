// const express = require('express');

// const routes = () => {
//   const controller = require('../controllers/linkedinPostController')();
//   const linkedinRouter = express.Router();
//   linkedinRouter.route('/postToLinkedIn').post(controller.postToLinkedin);

//   return linkedinRouter;
// };

// module.exports = routes;

const express = require('express');
const multer = require('multer');

const routes = () => {
  const controller = require('../controllers/linkedinPostController')();
  const linkedinRouter = express.Router();
  const upload = multer({ storage: multer.memoryStorage() });

  linkedinRouter.route('/postToLinkedIn').post(upload.array('media', 9), controller.postToLinkedin);

  return linkedinRouter;
};

module.exports = routes;