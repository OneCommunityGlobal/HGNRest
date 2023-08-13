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
            res.status(200).send(allRequests);
        } catch (error) {
            res.status(500).send(error);
        }
    };

    const getTimeOffRequestbyId = async (req, res) => {
        const requestId = req.params.id;

        try {
            const request = await TimeOffRequest.findById(requestId);

            if (!request) {
                res.status(404).send('Time off request not found');
                return;
            }

            res.status(200).send(request);
        } catch (error) {
            res.status(500).send(error);
        }
    };

    const updateTimeOffRequestById = async (req, res) => {
        const requestId = req.params.id;
        const { duration, startingDate, reason, requestFor } = req.body
        if (!duration || !startingDate || !reason || !requestFor) {
            res.status(400).send("bad request")
            return;
        }
        const startDate = moment(startingDate, 'MM/DD/YY');

        const endDate = startDate.clone().add(Number(duration), 'weeks');

        const endingDate = endDate.format('MM/DD/YY');

        const updateData = {
            requestFor: mongoose.Types.ObjectId(requestFor),
            reason: reason,
            startingDate: new Date(startingDate),
            endingDate: new Date(endingDate),
            duration: duration,
        };

        try {
            const updatedRequest = await TimeOffRequest.findByIdAndUpdate(requestId, updateData, {
                new: true,
            });

            if (!updatedRequest) {
                res.status(404).send('Time off request not found');
                return;
            }

            res.status(200).send(updatedRequest);
        } catch (error) {
            res.status(500).send(error);
        }
    };

    const deleteTimeOffRequestById = async (req, res) => {
        const requestId = req.params.id;

        try {
            const deletedRequest = await TimeOffRequest.findByIdAndDelete(requestId);

            if (!deletedRequest) {
                res.status(404).send('Time off request not found');
                return;
            }

            res.status(200).send('Time off request deleted successfully');
        } catch (error) {
            res.status(500).send(error);
        }
    };

    return {
        setTimeOffRequest,
        getTimeOffRequests,
        getTimeOffRequestbyId,
        updateTimeOffRequestById,
        deleteTimeOffRequestById
    };
};

module.exports = timeOffRequestController;