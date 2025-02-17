/* eslint-disable */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const currentWarningsController = function (currentWarnings) {
  const checkForDuplicates = (currentWarning, warnings) => {
    const duplicateFound = warnings.some(
      (warning) => warning.warningTitle.toLowerCase() === currentWarning,
    );

    return duplicateFound;
  };

  const checkIfSpecialCharacter = (warning) => {
    return !/^[a-zA-Z][a-zA-Z0-9]*(?: [a-zA-Z0-9]+)*$/.test(warning);
  };
  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({});

      if (response.length === 0) {
        return res.status(400).send({ message: 'no valid records', response: response });
      }
      return res.status(200).send({ currentWarningDescriptions: response });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postNewWarningDescription = async (req, res) => {
    const userRole = req.body?.requestor?.role;
    const isPrivilegedUser = userRole === 'Owner' || userRole === 'Administrator';
    if (!isPrivilegedUser &&
      !(await helper.hasPermission(req.body.requestor, 'addWarningTracker')) 
      
    ) {
     console.log('Preetham add a new WarningTracker'); 
      res.status(403).send('You are not authorized to add a new WarningTracker.');
      return;
    }
    try {
      const { newWarning, activeWarning, isPermanent } = req.body;

      const warnings = await currentWarnings.find({});

      if (warnings.length === 0) {
        return res.status(400).send({ error: 'no valid records' });
      }

      const testWarning = checkIfSpecialCharacter(newWarning);
      if (testWarning) {
        return res.status(200).send({
          error: 'Warning cannot have special characters as the first letter',
        });
      }

      if (checkForDuplicates(newWarning, warnings)) {
        return res.status(200).send({ error: 'warning already exists' });
      }

      const newWarningDescription = new currentWarnings();
      newWarningDescription.warningTitle = newWarning;
      newWarningDescription.activeWarning = activeWarning;
      newWarningDescription.isPermanent = isPermanent;

      warnings.push(newWarningDescription);
      await newWarningDescription.save();

      return res.status(201).send({ newWarnings: warnings });
    } catch (error) {
      return res.status(401).send({ message: error.message });
    }
  };

  const editWarningDescription = async (req, res) => {
    try {
      const { editedWarning } = req.body;

      const id = editedWarning._id;

      const warnings = await currentWarnings.find({});

      if (warnings.length === 0) {
        return res.status(400).send({ message: 'no valid records' });
      }

      const lowerCaseWarning = editedWarning.warningTitle.toLowerCase();
      const testWarning = checkIfSpecialCharacter(lowerCaseWarning);

      if (testWarning) {
        return res.status(200).send({
          error: 'Warning cannot have special characters as the first letter',
        });
      }

      if (checkForDuplicates(lowerCaseWarning, warnings)) {
        return res.status(200).send({ error: 'warning already exists try a different name' });
      }

      await currentWarnings.findOneAndUpdate(
        { _id: id },
        [{ $set: { warningTitle: lowerCaseWarning.trim() } }],
        { new: true },
      );

      res.status(201).send({ message: 'warning description was updated' });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };
  const updateWarningDescription = async (req, res) => {
    const userRole = req.body?.requestor?.role;
    const isPrivilegedUser = userRole === 'Owner' || userRole === 'Administrator';
    if (!isPrivilegedUser &&
      !(await helper.hasPermission(req.body.requestor, 'reactivateWarningTracker')) &&
      !(await helper.hasPermission(req.body.requestor, 'deactivateWarningTracker'))
    ) {
     console.log('Preetham reactivateWarningTracker or deactivate'); 
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
    const userRole = req.body?.requestor?.role;
    const isPrivilegedUser = userRole === 'Owner' || userRole === 'Administrator'; 
    if (!isPrivilegedUser &&
      !(await helper.hasPermission(req.body.requestor, 'deleteWarningTracker')) 
    ) {
     console.log('Preetham delete a WarningTracker'); 
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
