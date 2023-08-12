const timeOffRequestController = function (timeOffRequest) {
    const getTimeOffRequests = (req, res) => {
        res.status(200).send("test")
    };

    return {
        getTimeOffRequests,
    };
};

module.exports = timeOffRequestController;