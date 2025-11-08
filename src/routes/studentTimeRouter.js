const express = require("express");
const router = express.Router();
const timerCtrl = require("../controllers/studentTimerController");

router.use(express.json());

router.use((req, _res, next) => {
  next();
});


// Start new timer (replaces any existing one for the user)
router.post("/timer/start", timerCtrl.start);

// Pause a running timer
router.post("/timer/pause", timerCtrl.pause);

// Resume a paused timer
router.post("/timer/resume", timerCtrl.resume);

// Stop the timer
router.post("/timer/stop", timerCtrl.stop);

// Get status/progress/remaining
router.get("/timer/status", timerCtrl.status);

// Reset/clear timer back to idle 
router.post("/timer/reset", timerCtrl.reset);

module.exports = router;
