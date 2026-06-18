let outdated = false;

const setOutdatedWarningsFlag = () => {
  outdated = true;
};

const clearOutdatedWarningsFlag = () => {
  outdated = false;
};

const areWarningsInfoOutdated = () => outdated;

module.exports = {
  setOutdatedWarningsFlag,
  clearOutdatedWarningsFlag,
  areWarningsInfoOutdated,
};
