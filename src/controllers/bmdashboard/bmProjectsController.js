const mongoose = require('mongoose');

const bmMProjectsController = function () {
  // fetches projects with reference to BM userProfile id
  const bmProjectsSummary = async function _projSumm(req, res) {
    try {
        res.json({ message: 'Hello world' });

      // .then(results => res.status(200).send(results))
      // .catch(error => res.status(500).send(error))
    } catch (err) {
      res.json(err);
    }
  };
  return { bmProjectsSummary };
};

module.exports = bmMProjectsController;
