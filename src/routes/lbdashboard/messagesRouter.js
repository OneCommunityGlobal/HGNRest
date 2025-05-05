const express = require("express");
const {
  sendMessageHandler,
  getConversationHandler,
  updateMessageStatusHandler,
  getMessageStatusesHandler,
  getExistingChatsHandler,
  searchUserProfilesHandler,
  markMessagesAsRead,
} = require("../../websockets/lbMessaging/lbMessageHandler");
const routes = function () {
  const messagesRouter = express.Router();

  messagesRouter.post("/messages", (req, res) => sendMessageHandler(req, res));

  messagesRouter.get("/messages/conversation", getConversationHandler);

  messagesRouter.patch("/messages/status", (req, res) => updateMessageStatusHandler(req, res));

  messagesRouter.get("/messages/statuses", (req, res) => getMessageStatusesHandler(req, res));

  messagesRouter.get("/messages/existing-chats", getExistingChatsHandler);

  messagesRouter.get("/messages/search-users", (req, res) => searchUserProfilesHandler(req, res));

  messagesRouter.patch("/messages/mark-as-read", (req, res) => markMessagesAsRead(req, res));

  return messagesRouter;
};

module.exports = routes;