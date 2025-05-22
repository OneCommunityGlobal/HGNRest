const mongoose = require('mongoose');

const bmIssueController = function (BuildingIssue) {
    const bmGetIssue = async (req, res) => {
        try {
            BuildingIssue
            .find()
            .populate()
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const bmPostIssue = async (req, res) => {
        try {
            const newIssue = BuildingIssue.create(req.body)
            .then((result) => res.status(201).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const bmMostExpensiveIssues = async (req, res) => {
        const {option} = req.params;
        try {
            BuildingIssue
            .find({status: 'open'})
            .populate()
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    return { bmGetIssue, bmPostIssue, bmMostExpensiveIssues };
};

module.exports = bmIssueController;
