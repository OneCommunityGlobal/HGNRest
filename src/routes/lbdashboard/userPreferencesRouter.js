const express = require("express");
const { updatePreferences, getUserPreferences } = require("../../controllers/lbdashboard/lbuserPrefController");

const router = express.Router();

router
.put("/notification/:userId", updatePreferences)
.get("/notification/:userId", getUserPreferences);

module.exports = router;
