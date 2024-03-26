const notificationService = require('../services/notificationService');
const LOGGER = require('../startup/logger');

/**
 * API endpoint for notifications service.
 * @param {} Notification 
 * @returns 
 */

const notificationController = function () {
  /**
   * This function allows the user to get all notifications for themselves or
   *  allows the admin/owner user to get all notifications for a specific user.
   * @param {Object} req - The request with userID as request param.
   * @param {Object} res - The response object.
   * @returns {void}
   */
  const getUserNotifications = function (req, res) {
    res.status(403).send({ error: 'Unauthorized request' });
    // const { userId } = req.params;
    // const { requestor } = req.body;
    // if (requestor.requestorId !== userId && (requestor.role !== 'Administrator' || requestor.role !== 'Owner')) {
    //   res.status(403).send({ error: 'Unauthorized request' });
    //   return;
    // }

    // if (!userId) {
    //   res.status(400).send({ error: 'User ID is required' });
    //   return;
    // }

    // try {
    //   const result = notificationService.getNotifications(userId);
    //   res.status(200).send(result);
    // } catch (err) {
    //   LOGGER.logException(err);
    //   res.status(500).send({ error: 'Internal Error' });
    // }
  };

    /**
   * This function allows the user to get unread notifications for themselves or
   *  allows the admin/owner user to get unread notifications for a specific user.
   * @param {Object} req - The request with userID as request param.
   * @param {Object} res - The response object.
   * @returns {void}
   */
  const getUnreadUserNotifications = function (req, res) {
    const { userId } = req.params;
    const { requestor } = req.body;
    if (requestor.requestorId !== userId && (requestor.role !== 'Administrator' || requestor.role !== 'Owner')) {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    if (!userId) {
      res.status(400).send({ error: 'User ID is required' });
      return;
    }

    try {
      const result = notificationService.getUnreadUserNotifications(userId);
      res.status(200).send(result);
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  /**
   * This function allows the admin/owner user to get all notifications that they have sent.
   * @param {*} req 
   * @param {*} res 
   * @returns 
   */
  const getSentNotifications = function (req, res) {
    const { requestor } = req.body;
    if ((requestor.role !== 'Administrator' || requestor.role !== 'Owner')) {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    try {
      const result = notificationService.getSentNotifications(requestor.requestorId);
      res.status(200).send(result);
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };


  /**
   * This function allows the Administrator/Owner user to create a notification to specific user.
   * @param {*} req request with a JSON payload containing the message and recipient list.
   * @param {*} res 
   * @returns 
   */
  const createUserNotification = async function (req, res) {
    const { message, recipient } = req.body;
    const sender = req.requestor.requestorId;

    if (req.body.requestor.role !== 'Administrator' || req.body.requestor.role !== 'Owner') {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    if (!message || !recipient) {
      res.status(400).send({ error: 'Message and recipient are required' });
      return;
    }

    try {
      const result = await notificationService.createNotification(sender, recipient, message);
      res.status(200).send(result);
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  /**
   * This function allows the Administrator/Owner user to delete a notification.
   * @param {*} req request with the notification ID as a parameter.
   * @param {*} res 
   * @returns 
   */
  const deleteUserNotification = function (req, res) {
    const { requestor } = req.body;

    if (requestor.role !== 'Administrator' || requestor.role !== 'Owner') {
      res.status(403).send({ error: 'Unauthorized request' });
      return;
    }

    try {
      const result = notificationService.deleteNotification(req.params.notificationId);
      res.status(200).send(result);
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  /**
   * This function allows the user to mark a notification as read.
   * @param {*} req request with the notification ID as a parameter.
   * @param {*} res 
   * @returns 
   */
  const markNotificationAsRead = function (req, res) {
    const recipientId = req.body.requestor.requestorId;

    if (!recipientId) {
      res.status(400).send({ error: 'Recipient ID is required' });
      return;
    }

    try {
      const result = notificationService.markNotificationAsRead(req.params.notificationId, recipientId);
      res.status(200).send(result);
    } catch (err) {
      LOGGER.logException(err);
      res.status(500).send({ error: 'Internal Error' });
    }
  };

  return {
    getUserNotifications,
    getUnreadUserNotifications,
    getSentNotifications,
    deleteUserNotification,
    createUserNotification,
    markNotificationAsRead,
  };
};

module.exports = notificationController;
