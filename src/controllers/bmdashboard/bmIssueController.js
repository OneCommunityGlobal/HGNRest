const mongoose = require('mongoose');

const bmIssueController = function (BuildingIssue) {
    const bmGetIssue = async (req, res) => {
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

    const bmPostIssue = async (req, res) => {
        try {
            const newIssue = BuildingIssue.create(req.body)
            .then((result) => res.status(201).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };
    const bmUpdateIssueName = async (req, res) => {
        try {

            const updates = req.body;
            console.log(update);

            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ message: 'Invalid update data.' });
            }

            Issue.findByIdAndUpdate(
                req.params.id,
                { $set: updates },
                { new: true }
            )
                .then(updatedIssue => {
                    if (!updatedIssue) {
                        return res.status(404).json({ message: 'Issue not found.' });
                    }
                    res.json(updatedIssue);
                })
                .catch(err => res.status(500).json({ error: err.message }));
        } catch (error) {
            res.json({ error: error.message });
          }
    };

    return { bmGetIssue, bmPostIssue, bmUpdateIssueName };
};

module.exports = bmIssueController;
