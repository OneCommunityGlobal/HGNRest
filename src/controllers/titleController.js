const Team = require('../models/team');
const Project = require('../models/project');
const cacheClosure = require('../utilities/nodeCache');
const { getAllTeamCodeHelper } = require("./userProfileController");

const titlecontroller = function (Title) {
  const cache = cacheClosure();

    const getAllTitles = function (req, res) {
      Title.find({})
        .then((results) => res.status(200).send(results))
        .catch((error) => res.status(404).send(error));
  };

    const getTitleById = function (req, res) {
      const { titleId } = req.params;

      Title.findById(titleId)
        .then((results) => res.send(results))
        .catch((error) => res.send(error));
    };

    const postTitle = async function (req, res) {
      const title = new Title();

      title.titleName = req.body.titleName;
      title.teamCode = req.body.teamCode;
      title.projectAssigned = req.body.projectAssigned;
      title.mediaFolder = req.body.mediaFolder;
      title.teamAssiged = req.body.teamAssiged;

      // valid title name
      if (!title.titleName.trim()) {
        res.status(400).send({ message: 'Title cannot be empty.' });
        return;
      }

      //  if media is empty
      if (!title.mediaFolder.trim()) {
        res.status(400).send({ message: 'Media folder cannot be empty.' });
        return;
      }

      const shortnames = title.titleName.trim().split(' ');
      let shortname;
      if (shortnames.length > 1) {
          shortname = (shortnames[0][0] + shortnames[1][0]).toUpperCase();
      } else if (shortnames.length === 1) {
          shortname = shortnames[0][0].toUpperCase();
      }
      title.shortName = shortname;

      // Validate team code by checking if it exists in the database
      if (!title.teamCode) {
        res.status(400).send({ message: 'Please provide a team code.' });
        return;
      }

      const teamCodeExists = await checkTeamCodeExists(title.teamCode);
      if (!teamCodeExists) {
        res.status(400).send({ message: 'Invalid team code. Please provide a valid team code.' });
        return;
      }

      // validate if project exist
      const projectExist = await checkProjectExists(title.projectAssigned._id);
      if (!projectExist) {
        res.status(400).send({ message: 'Project is empty or not exist.' });
        return;
      }

      // validate if team exist
      if (title.teamAssiged && title.teamAssiged._id === 'N/A') {
        res.status(400).send({ message: 'Team not exists.' });
        return;
      }

      title
        .save()
        .then((results) => res.status(200).send(results))
        .catch((error) => res.status(404).send(error));
    };

    const deleteTitleById = async function (req, res) {
      const { titleId } = req.params;
      Title.deleteOne({ _id: titleId })
        .then((result) => res.send(result))
        .catch((error) => res.send(error));
    };

    const deleteAllTitles = async function (req, res) {
      Title.deleteMany({})
        .then((result) => {
            if (result.deletedCount === 0) {
                res.send({ message: 'No titles found to delete.' });
            } else {
                res.send({ message: `${result.deletedCount} titles were deleted successfully.` });
            }
        })
        .catch((error) => {
            res.status(500).send(error);
        });
    };
    // Update: Confirmed with Jae. Team code is not related to the Team data model. But the team code field within the UserProfile data model.
    async function checkTeamCodeExists(teamCode) {
      try {
        if (cache.getCache('teamCodes')) {
          const teamCodes = JSON.parse(cache.getCache('teamCodes'));
          return teamCodes.includes(teamCode);
        }
        const teamCodes = await getAllTeamCodeHelper();
        return teamCodes.includes(teamCode);
      } catch (error) {
        console.error('Error checking if team code exists:', error);
        throw error;
      }
    }

    async function checkProjectExists(projectID) {
      try {
        const project = await Project.findOne({ _id: projectID }).exec();
        return !!project;
      } catch (error) {
        console.error('Error checking if project exists:', error);
        throw error;
      }
    }

  return {
    getAllTitles,
    getTitleById,
    postTitle,
    deleteTitleById,
    deleteAllTitles,
  };
};

  module.exports = titlecontroller;
