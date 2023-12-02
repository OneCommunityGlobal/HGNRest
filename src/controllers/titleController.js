// const mongoose = require('mongoose');
// const UserProfile = require('../models/userProfile');
// const cache = require('../utilities/nodeCache')();
// const { hasPermission } = require('../utilities/permissions');

const titlecontroller = function (Title) {
  const getAllTitles = function (req, res) {
    Title.find({})
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
};

  const getTitleById = function (req, res) {
    const { titleId } = req.params;

    Title.findById(titleId)
      .then(results => res.send(results))
      .catch(error => res.send(error));
  };

  const postTitle = async function (req, res) {
    console.log('posttitle');
    console.log('body', req.body);

    // if (await Title.exists({ titleName: req.body.titleName })) {
    //   res.send({ error: `Title Name ${req.body.titleName} already exists` });
    // }

    const title = new Title();

    title.titleName = req.body.titleName;
    title.teamCode = req.body.teamCode;
    title.projectAssigned = req.body.projectAssigned;
    title.mediaFolder = req.body.mediaFolder;
    title.teamAssiged = req.body.teamAssiged;
    // get the shortname
    let shortnames = title.titleName.split('');
    let shortname = shortnames[0][0] + shortname[1][0];

    title.shortName = shortname;

    title
      .save()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };


  return {
    getAllTitles,
    getTitleById,
    postTitle,
  };
};

module.exports = titlecontroller;
