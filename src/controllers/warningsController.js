const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");

const warningsController = function () {
  const getWarningsByUserId = async function (req, res) {
    console.log("get warning called", req.body);
  };

  const postUserProfile = async function (req, res) {};

  return {
    getWarningsByUserId,
  };
};

module.exports = warningsController;
