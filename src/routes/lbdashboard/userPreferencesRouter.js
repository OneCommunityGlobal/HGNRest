const express = require("express");
const { updatePreferences } = require("../../controllers/lbdashboard/lbuserPrefController");

const router = express.Router();

router.patch("/:userId", updatePreferences);

module.exports = router;
