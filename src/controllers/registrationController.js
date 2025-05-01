const mongoose = require('mongoose');
const Registration = require('../models/registration');
const cache = require('../utilities/nodeCache')();
const logger = require('../startup/logger');

const registrationController = function () {
    const createRegistration = async function (req, res) { 

      if (!req.body.eventId) {
        return res.status(400).send({
          error: 'Event ID is a mandatory field'
        });
      }
  
      try {
        const { eventId } = req.body;
        const userId = req.body.requestor.requestorId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).send({ error: 'Invalid user ID format' });
        }
  
        // check for existing registration
        const existingRegistration = await Registration.findOne({
          userId,
          eventId,
          status: { $in: ['confirmed', 'pending'] }
        });
  
        if (existingRegistration) {
          return res.status(400).send({ error: 'You are already registered for this event' });
        }
  
        const registration = new Registration({
          userId,
          eventId,
          status: 'confirmed',
          registrationDate: new Date()
        });
  
        await registration.save();
        
        // clear user cache if exists
        cache.removeCache(`user-${userId}`);
  
        return res.status(201).json({
          success: true,
          data: registration,
          message: 'Successfully registered for event'
        });
  
      } catch (error) {
        logger.logException(error);
        return res.status(400).send({ error: error.message });
      }
    };
  
    const cancelRegistration = async function (req, res) {
  
      try {
        const { registrationId } = req.body;
        const userId = req.body.requestor.requestorId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).send({ error: 'Invalid user ID format' });
        }
  
        const registration = await Registration.findOne({
          _id: registrationId,
          userId
        });
  
        if (!registration) {
          return res.status(404).send({ error: 'Registration not found' });
        }
  
        if (registration.status === 'cancelled') {
          return res.status(400).send({ error: 'Registration is already cancelled' });
        }
  
        registration.status = 'cancelled';
        registration.cancellationDate = new Date();
  
        await registration.save();
  
        // clear cache
        cache.removeCache(`user-${userId}`);
  
        return res.status(200).json({
          success: true,
          data: registration,
          message: 'Registration successfully cancelled'
        });
  
      } catch (error) {
        logger.logException(error);
        return res.status(400).send({ error: error.message });
      }
    };
  
    return {
      createRegistration,
      cancelRegistration,
    };
  };
  
  module.exports = registrationController;