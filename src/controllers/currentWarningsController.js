/* eslint-disable */
const mongoose = require('mongoose');
const userProfile = require('../models/userProfile');
const helper = require('../utilities/permissions');
const { setOutdatedWarningsFlag } = require('../utilities/warningsCache');
const { cleanHtml } = require('../utilities/htmlContentSanitizer');
const currentWarningsController = function (currentWarnings) {
  const normalizeWarningTitle = (warningTitle /*: string */) => warningTitle.toLowerCase().trim();

  const checkIfSpecialCharacter = (warning) => {
    return !/^[a-zA-Z][a-zA-Z0-9,+-]*(?: [a-zA-Z0-9,+-]+)*$/.test(warning);
  };

  const addMissingOrderValues = async (warnings) => {
    const updates = [];
    warnings.forEach((warning, index) => {
      if (warning.order === null || warning.order === undefined || warning.order === -1) {
        updates.push({
          updateOne: {
            filter: { _id: warning._id },
            update: { $set: { order: index } },
          },
        });
      }
    });

    if (updates.length > 0) {
      await currentWarnings.bulkWrite(updates);
    }
    // only updates warnings missing an order value
    return warnings.map((warning, index) => ({
      ...warning,
      order:
        warning.order === null || warning.order === undefined || warning.order === -1
          ? index
          : warning.order,
    }));
  };

  const addMissingOrderSequence = async (warnings) => {
    // only updates warnings missing a orderSequence
    const updates = [];
    warnings.forEach((warning, index) => {
      if (
        warning.orderSequence === null ||
        warning.orderSequence === undefined ||
        warning.orderSequence === -1
      ) {
        updates.push({
          updateOne: {
            filter: { _id: warning._id },
            update: { $set: { orderSequence: index } },
          },
        });
      }
    });

    if (updates.length > 0) {
      await currentWarnings.bulkWrite(updates);
    }
    // removes orderSequence from warnings to avoid being sent to frontend
    return warnings.map(({ orderSequence, ...warning }) => warning);
  };

  const addMissingDescriptions = async (warnings) => {
    const updates = [];
    warnings.forEach((warning) => {
      if (
        warning.description === null ||
        warning.description === undefined ||
        warning.description === -1
      ) {
        updates.push({
          updateOne: {
            filter: { _id: warning._id },
            update: { $set: { description: 'No description provided yet' } },
          },
        });
      }
    });

    if (updates.length > 0) {
      await currentWarnings.bulkWrite(updates);
    }
    // only updates warnings missing a description
    return warnings.map((warning) => ({
      ...warning,
      description:
        warning.description === null ||
        warning.description === undefined ||
        warning.description === -1
          ? 'No description provided yet'
          : warning.description,
    }));
  };

  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({}).sort({ order: 1 }).lean();

      if (response.length === 0) {
        return res.status(400).send({ message: 'No records', response: response });
      }

      const missingOrder = response.some(
        (warning) => warning.order === null || warning.order === undefined || warning.order === -1,
      );
      const warningsWithOrder = missingOrder ? await addMissingOrderValues(response) : response;
      const missingOrderSequence = warningsWithOrder.some(
        (warning) =>
          warning.orderSequence === null ||
          warning.orderSequence === undefined ||
          warning.orderSequence === -1,
      );
      const warningsWithOrderSequence = missingOrderSequence
        ? await addMissingOrderSequence(warningsWithOrder)
        : warningsWithOrder.map(({ orderSequence, ...warning }) => warning);
      const missingDescription = warningsWithOrderSequence.some(
        (warning) =>
          warning.description === null ||
          warning.description === undefined ||
          warning.description === -1,
      );
      const updatedWarnings = missingDescription
        ? await addMissingDescriptions(warningsWithOrderSequence)
        : warningsWithOrderSequence;
      return res.status(200).send({ currentWarningDescriptions: updatedWarnings });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const postNewWarningDescription = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'addWarningTracker'))) {
      res.status(403).send('You are not authorized to add a new WarningTracker.');
      return;
    }
    try {
      const { newWarning, activeWarning, isPermanent, newWarningDescription } = req.body;
      if (typeof newWarningDescription !== 'string') {
        return res.status(400).send({ error: 'Description must be a string' });
      }
      if (newWarningDescription.length > 500)
        return res.status(400).send({ error: 'Description cannot exceed 500 characters' });
      const normalizedWarningTitle = normalizeWarningTitle(newWarning);
      const trimmedWarning = newWarning.trim();

      const trimmedDescription = newWarningDescription.trim();
      const cleanedDescription = cleanHtml(trimmedDescription);
      // Validate first
      if (checkIfSpecialCharacter(normalizedWarningTitle)) {
        return res.status(400).send({
          error: 'Warnings cannot have special characters as the first letter',
        });
      }

      // DB check
      const warning = await currentWarnings.exists({
        warningTitle: normalizedWarningTitle,
      });

      if (warning) {
        return res.status(400).send({
          error: 'Warning already exists, please try a different name',
        });
      }
      // Prevents simultaneous requests of new warnings to have same order value assigned
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const lastWarning = await currentWarnings.findOne().sort({ orderSequence: -1 });
          const newOrderSequence = (lastWarning?.orderSequence ?? -1) + 1;

          await new currentWarnings({
            warningTitle: trimmedWarning,
            activeWarning,
            isPermanent,
            order: newOrderSequence,
            orderSequence: newOrderSequence,
            ...(cleanedDescription && { description: cleanedDescription }),
          }).save();
          break;
        } catch (error) {
          console.log('got concurrent request');
          // reattempt for concurrent warning tracker creation requests up to 3 times
          if (error.code === 11000 && attempt < 2) {
            console.log('attempt count: ', attempt);
            continue;
          } else if (error.code === 11000) {
            return res.status(409).send({
              message:
                'Unable to create the warning due to concurrent requests. Please try again later.',
            });
          } else {
            throw error;
          }
        }
      }

      const updatedWarnings = await currentWarnings.find({}).lean();
      const returnedWarnings = updatedWarnings.map(({ orderSequence, ...warning }) => warning);
      return res.status(201).send({ newWarnings: returnedWarnings });
    } catch (error) {
      return res.status(401).send({ message: error.message });
    }
  };

  const editWarningDescription = async (req, res) => {
    if (
      !(await helper.hasPermission(req.body.requestor, 'addWarningTracker')) &&
      !(await helper.hasPermission(req.body.requestor, 'deleteWarningTracker'))
    ) {
      res.status(403).send('You are not authorized to edit a WarningTracker.');
      return;
    }

    try {
      const { editedWarning } = req.body;
      const normalizedWarningTitle = normalizeWarningTitle(editedWarning.warningTitle);
      const trimmedWarning = editedWarning.warningTitle.trim();
      // Check client input first
      if (checkIfSpecialCharacter(normalizedWarningTitle)) {
        return res.status(400).send({
          error: 'Warning cannot have special characters as the first letter',
        });
      }

      // Check if the new warning title already exists
      if (await currentWarnings.exists({ warningTitle: normalizedWarningTitle })) {
        return res
          .status(400)
          .send({ error: 'Warning already exists, please try a different name' });
      }

      // Fetch the warning to be edited
      const warning = await currentWarnings.findOne({ _id: editedWarning._id });

      if (!warning) {
        return res.status(400).send({ message: 'Warning not found.' });
      }

      warning.warningTitle = trimmedWarning;

      await warning.save();
      setOutdatedWarningsFlag();
      res.status(201).send({ message: 'warning description was updated' });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const reorderWarningDescriptions = async (req, res) => {
    if (
      !(await helper.hasPermission(req.body.requestor, 'addWarningTracker')) &&
      !(await helper.hasPermission(req.body.requestor, 'deleteWarningTracker'))
    ) {
      res.status(403).send('You are not authorized to edit the order of the WarningTrackers.');
      return;
    }
    try {
      const reorderedWarningDescriptions = req.body.warningDescriptions;
      const response = await currentWarnings.find({}).sort({ order: 1 });

      reorderedWarningDescriptions.map((warning, index) => (warning.order = index));
      await currentWarnings.bulkWrite(
        response.map((warning, index) => ({
          updateOne: {
            filter: { _id: warning._id },
            update: {
              $set: {
                order: reorderedWarningDescriptions.findIndex(
                  (warn) => warn.warningTitle === warning.warningTitle,
                ),
              },
            },
          },
        })),
      );

      setOutdatedWarningsFlag();
      res.status(201).send({
        reorderedWarningDescriptions: reorderedWarningDescriptions,
      });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };
  const updateWarningDescription = async (req, res) => {
    if (
      !(await helper.hasPermission(req.body.requestor, 'reactivateWarningTracker')) &&
      !(await helper.hasPermission(req.body.requestor, 'deactivateWarningTracker'))
    ) {
      res
        .status(403)
        .send(
          'You are not authorized to reactivate a WarningTracker or deactivate warning tracker.',
        );
      return;
    }
    try {
      const { warningDescriptionId } = req.params;

      await currentWarnings.findOneAndUpdate(
        { _id: warningDescriptionId },
        [{ $set: { activeWarning: { $not: '$activeWarning' } } }],
        { new: true },
      );
      setOutdatedWarningsFlag();
      res.status(201).send({ message: 'warning description was updated' });
    } catch (error) {
      res.status(401).send({ message: error.message || error });
    }
  };

  const deleteWarningDescription = async (req, res) => {
    if (!(await helper.hasPermission(req.body.requestor, 'deleteWarningTracker'))) {
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
      setOutdatedWarningsFlag();
      return res.status(200).send({ message: 'warning description was successfully deleted' });
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
    reorderWarningDescriptions,
  };
};
module.exports = currentWarningsController;
