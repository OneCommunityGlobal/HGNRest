const express = require("express");
const { updatePreferences, getUserPreferences, lbsendEmail, lbsendSMS} = require("../../controllers/lbdashboard/lbuserPrefController");

const router = express.Router();

router
.put("/notification/:userId", updatePreferences)
.get("/notification/:userId", getUserPreferences)
.post("/notification/email", lbsendEmail)
.post("/notification/sms", lbsendSMS);

module.exports = router;
