// const mongoose = require('mongoose');

const wbsController = function () {
  const getAllWBS = function (req, res) {
    res.status(200).send({ test: 'gotWBS' });
  };


  return {
    getAllWBS,
  };
};


module.exports = wbsController;
