const ApplicationAccess = require('../../models/applicationAccess');

async function getAppAccess(req, res) {
    try {
        const { userId } = req.query;
        const appAccess = await ApplicationAccess.findOne({ userId });

        if (!appAccess) {
            return res.status(200).json({ 
                found: false, 
                message: 'Application access record not found for this user.' 
            });
        }

        res.status(200).json({ 
            found: true, 
            data: appAccess 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAppAccess,
};
