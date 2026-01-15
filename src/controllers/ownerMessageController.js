const mongoose = require('mongoose');
const helper = require('../utilities/permissions');
const OwnerMessageLog = require('../models/ownerMessageLog');
const UserProfile = require('../models/userProfile');

const ownerMessageController = function (OwnerMessage) {
  const logOwnerMessageAction = async function (
    session,
    actionType,
    oldMessage,
    oldStandardMessage,
    ownerMessage,
    requestorId,
    requestorRole,
  ) {
    // Fetch requestor profile
    const requestor = await UserProfile.findById(requestorId);
    // Log the update action
    await OwnerMessageLog.create(
      [
        {
          oldMessage,
          newMessage: ownerMessage.message,
          oldStandardMessage,
          newStandardMessage: ownerMessage.standardMessage,
          action: actionType,
          requestorId,
          requestorRole,
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
      const oldMessage = ownerMessage.message;
      const oldStandardMessage = ownerMessage.standardMessage;

      if (isStandard) {
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
        oldStandardMessage,
        ownerMessage,
        req.body.requestor.requestorId,
        req.body.requestor.role,
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
        ownerMessage.standardMessage,
        ownerMessage,
        req.body.requestor.requestorId,
        req.body.requestor.role,
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
