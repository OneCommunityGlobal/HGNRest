const express = require("express");
const {
  sendMessageHandler,
  getConversationHandler,
  updateMessageStatusHandler,
} = require("../../websockets/lbMessaging/lbMessageHandler");

const routes = function (io) {
  const messagesRouter = express.Router();

  // Route to send a message
  messagesRouter.post("/messages", (req, res) => sendMessageHandler(req, res, io));

  // Route to get conversation history
  messagesRouter.get("/messages/conversation", getConversationHandler);

  // Route to update message status
  messagesRouter.patch("/messages/status", (req, res) => updateMessageStatusHandler(req, res, io));

  return messagesRouter;
};

module.exports = routes;