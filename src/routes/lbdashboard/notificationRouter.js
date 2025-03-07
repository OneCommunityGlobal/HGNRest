const express = require("express");
const { sendNotification } = require("../../controllers/lbdashboard/lbnotificationController");

const router = express.Router();

router.post("/send", async (req, res) => {
    try {
        const { userId, message } = req.body;
        await sendNotification(userId, message);
        res.json({ message: "Notification sent" });
    } catch (error) {
        res.status(500).json({ error: "Error sending notification" });
    }
});

module.exports = router;
