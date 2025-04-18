const express = require("express");

const routes = function (Message, Notification) {
  const messagesRouter = express.Router();
  const controller = require("../../controllers/lbdashboard/lbMessageController")(Message, Notification);

  // Route to send a message
  messagesRouter.route("/messages").post(controller.sendMessage);

  // Route to get conversation history
  messagesRouter.route("/messages/conversation").get(controller.getConversation);

  // Route to update message status
  messagesRouter.route("/messages/status").patch(controller.updateMessageStatus);

  return messagesRouter;
};

module.exports = routes;