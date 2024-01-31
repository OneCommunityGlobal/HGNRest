const mongoose = require("mongoose");

const currentWarningsController = function (currentWarnings) {
  const getCurrentDescriptions = (req, res) => {
    console.log("current warnrnigns controlel called");
  };

  const postcurrentDescriptions = (req, res) => {
    console.log("current warnrnigns controlel called");
  };

  return {
    getCurrentDescriptions,
    postcurrentDescriptions,
  };
};

module.exports = currentWarningsController;
