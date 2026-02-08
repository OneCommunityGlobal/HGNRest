/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const helper = require('../utilities/permissions');
const OwnerMessageLog = require('../models/ownerMessageLog');
const UserProfile = require('../models/userProfile');

const ownerMessageController = function (OwnerMessage) {
  const logOwnerMessageAction = async function (
    session,
    actionType,
    oldMessage,
    newMessage,
    isStandard,
    requestorId,
  ) {
    // Fetch requestor profile
    const requestor = await UserProfile.findById(requestorId);
    // Log the update action
    let action = 'Update message';
    if (actionType === 'UPDATE') {
      if (isStandard) {
        action = 'Update standard message';
      }
    } else {
      action = 'Delete message';
    }
    await OwnerMessageLog.create(
      [
        {
          oldMessage,
          newMessage,
          action,
          requestorId,
          requestorEmail: requestor.email,
          requestorName: `${requestor.firstName} ${requestor.lastName}`,
        },
      ],
      { session },
    );
  };

  const getOwnerMessage = async function (req, res) {
    try {
      const results = await OwnerMessage.find({});
      if (results.length === 0) {
        // first time initialization
        const ownerMessage = new OwnerMessage();
        await ownerMessage.save();
        res.status(200).send({ ownerMessage });
      } else {
        res.status(200).send({ ownerMessage: results[0] });
      }
    } catch (error) {
      res.status(404).send(error);
    }
  };

  const updateOwnerMessage = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'editHeaderMessage'))) {
      res.status(403).send('You are not authorized to create messages!');
    }
    const { isStandard, newMessage } = req.body;
    // Use a session to ensure atomicity of operations
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const results = await OwnerMessage.find({}).session(session);
      const ownerMessage = results[0];
      // Save old messages for logging
      let oldMessage = ownerMessage.message;
      if (isStandard) {
        oldMessage = ownerMessage.standardMessage;
        ownerMessage.standardMessage = newMessage;
        ownerMessage.message = '';
      } else {
        ownerMessage.message = newMessage;
      }
      await ownerMessage.save({ session });

      // Log the update action
      await logOwnerMessageAction(
        session,
        'UPDATE',
        oldMessage,
        newMessage,
        isStandard,
        req.body.requestor.requestorId,
      );

      await session.commitTransaction();
      const { standardMessage, message } = ownerMessage;
      res.status(201).send({
        _serverMessage: 'Update successfully!',
        ownerMessage: { standardMessage, message },
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).send(error);
    } finally {
      session.endSession();
    }
  };

  const deleteOwnerMessage = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'editHeaderMessage'))) {
      res.status(403).send('You are not authorized to delete messages!');
    }
    // Use a session to ensure atomicity of operations
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const results = await OwnerMessage.find({}).session(session);
      const ownerMessage = results[0];
      const oldMessage = ownerMessage.message;
      ownerMessage.message = '';
      await ownerMessage.save({ session });

      // Log the update action
      await logOwnerMessageAction(
        session,
        'DELETE',
        oldMessage,
        '',
        false,
        req.body.requestor.requestorId,
      );
      await session.commitTransaction();

      res.status(200).send({ _serverMessage: 'Delete successfully!', ownerMessage });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).send(error);
    } finally {
      session.endSession();
    }
  };

  return {
    getOwnerMessage,
    updateOwnerMessage,
    deleteOwnerMessage,
  };
};

module.exports = ownerMessageController;
