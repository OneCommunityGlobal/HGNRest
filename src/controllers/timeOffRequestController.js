const mongoose = require('mongoose');
const moment = require('moment');

const timeOffRequestController = function (TimeOffRequest) {
    const setTimeOffRequest = async (req, res) => {

        const { duration, startingDate, reason, requestFor } = req.body
        if (!duration || !startingDate || !reason || !requestFor) {
            res.status(400).send("bad request")
            return;
        }
        try {
            const startDate = moment(startingDate, 'MM/DD/YY');

            const endDate = startDate.clone().add(Number(duration), 'weeks');

            const endingDate = endDate.format('MM/DD/YY');

            const newTimeOffRequest = new TimeOffRequest();

            newTimeOffRequest.requestFor = mongoose.Types.ObjectId(requestFor)
            newTimeOffRequest.reason = reason
            newTimeOffRequest.startingDate = new Date(startingDate)
            newTimeOffRequest.endingDate = new Date(endingDate)
            newTimeOffRequest.duration = Number(duration)

            const savedRequest = await newTimeOffRequest.save();
            res.status(201).send(savedRequest)
        } catch (error) {
            res.status(500).send(error)
        }

    };

    const getTimeOffRequests = async (req, res) => {
        try {
            const allRequests = await TimeOffRequest.find();
            res.status(200).json(allRequests);
        } catch (error) {
            res.status(500).send(error);
        }
    };

    const getTimeOffRequestbyId = async (req, res) => {
        const requestId = req.params.id;

        try {
            const request = await TimeOffRequest.findById(requestId);

            if (!request) {
                res.status(404).json({ error: 'Time off request not found' });
                return;
            }

            res.status(200).json(request);
        } catch (error) {
            res.status(500).send(error);
        }
    };

    const updateTimeOffRequest = async (req, res) => {
        res.status(200).send("test")
    };

    return {
        setTimeOffRequest,
        getTimeOffRequests,
        getTimeOffRequestbyId,
        updateTimeOffRequest
    };
};

module.exports = timeOffRequestController;