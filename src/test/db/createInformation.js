const Information = require('../../models/information');

const createInformation = async (infoContent, visibility) => {
  const _information = new Information();

  _information.infoName = 'test Info';
  _information.infoContent = infoContent;
  _information.visibility = visibility;

  const information = await _information.save();
  return information;
};

module.exports = createInformation;