const express = require("express");
const { sendMessage, getMessages, updateMessageStatus } = require("../../controllers/lbdashboard/lbmessageController");

const router = express.Router();

router.post("/send", sendMessage);
router.get("/:userId", getMessages);
router.patch("/:messageId/status", updateMessageStatus);

module.exports = router;