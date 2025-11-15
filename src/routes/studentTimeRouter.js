const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/studentTimerController");

router.use(express.json());

router.post("/timer/start", ctrl.start);
router.post("/timer/pause", ctrl.pause);
router.post("/timer/resume", ctrl.resume);
router.post("/timer/stop", ctrl.stop);
router.post("/timer/reset", ctrl.reset);
router.get("/timer/status", ctrl.status);
router.get("/timer/history", ctrl.history);
router.post("/timer/adjust", ctrl.adjust);

module.exports = router;
