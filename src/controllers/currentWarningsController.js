/* eslint-disable */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const currentWarningsController = function (currentWarnings) {
  const normalizeWarningTitle = (warningTitle /*: string */) => warningTitle.toLowerCase().trim();

  const checkIfSpecialCharacter = (warning) => {
    return !/^[a-zA-Z][a-zA-Z0-9]*(?: [a-zA-Z0-9]+)*$/.test(warning);
  };

  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({});

      if (response.length === 0) {
        return res.status(400).send({ message: 'No records', response: response });
      }
      return res.status(200).send({ currentWarningDescriptions: response });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postNewWarningDescription = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'addWarningTracker')) 
      
    ) {
      res.status(403).send('You are not authorized to add a new WarningTracker.');
      return;
    }
    try {
      const { newWarning, activeWarning, isPermanent } = req.body;
      const newWarningTitle = normalizeWarningTitle(newWarning);

      // Validate first
      if (checkIfSpecialCharacter(newWarningTitle)) {
        return res.status(400).send({
          error: 'Warnings cannot have special characters as the first letter',
        });
      }

      // DB check
      const warning = await currentWarnings.exists({
        warningTitle: newWarningTitle,
      });

      if (warning) {
        return res.status(400).send({
          error: 'Warning already exists, please try a different name',
        });
      }

      const newWarningDescription = new currentWarnings();
      newWarningDescription.warningTitle = newWarningTitle;
      newWarningDescription.activeWarning = activeWarning;
      newWarningDescription.isPermanent = isPermanent;

      await newWarningDescription.save();

      return res.status(201).send({ newWarnings: await currentWarnings.find({}) });
    } catch (error) {
      return res.status(401).send({ message: error.message });
    }
  };

  const editWarningDescription = async (req, res) => {
    try {
      const { editedWarning } = req.body;
      const newWarningTitle = normalizeWarningTitle(editedWarning.warningTitle);

      // Check client input first
      if (checkIfSpecialCharacter(newWarningTitle)) {
        return res.status(400).send({
          error: 'Warning cannot have special characters as the first letter',
        });
      }

      // Check if the new warning title already exists
      if (await currentWarnings.exists({ warningTitle: newWarningTitle })) {
        return res.status(400).send({ error: 'Warning already exists, please try a different name' });
      }

      // Fetch the warning to be edited
      const warning = await currentWarnings.findOne({ _id: editedWarning._id });

      if (!warning) {
        return res.status(400).send({ message: 'Warning not found.' });
      }

      warning.warningTitle = newWarningTitle;

      await warning.save();
      res.status(201).send({ message: 'warning description was updated' });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };
  const updateWarningDescription = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'reactivateWarningTracker')) &&
      !(await helper.hasPermission(req.body.requestor, 'deactivateWarningTracker'))
    ) {
      res.status(403).send('You are not authorized to reactivate a WarningTracker or deactivate warning tracker.');
      return;
    }
    try {
      const { warningDescriptionId } = req.params;

      await currentWarnings.findOneAndUpdate(
        { _id: warningDescriptionId },
        [{ $set: { activeWarning: { $not: '$activeWarning' } } }],
        { new: true },
      );

      res.status(201).send({ message: 'warning description was updated' });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const deleteWarningDescription = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'deleteWarningTracker')) 
    ) {
      res.status(403).send('You are not authorized to delete a WarningTracker.');
      return;
    }
    try {
      const { warningDescriptionId } = req.params;
      const documentToDelete = await currentWarnings.findById(warningDescriptionId);

      await currentWarnings.deleteOne({
        _id: mongoose.Types.ObjectId(warningDescriptionId),
      });

      const deletedDescription = documentToDelete.warningTitle;

      await userProfile.updateMany(
        {
          'warnings.description': deletedDescription,
        },
        {
          $pull: {
            warnings: { description: deletedDescription },
          },
        },
      );

      return res.status(200);
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  return {
    getCurrentWarnings,
    postNewWarningDescription,
    updateWarningDescription,
    deleteWarningDescription,
    editWarningDescription,
  };
};
module.exports = currentWarningsController;
