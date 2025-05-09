const bmIssueController = function (metIssue) {
    const bmGetIssue = async (req, res) => {
        try {
<<<<<<< HEAD
            BuildingIssue
            .find({status: 'open'})
            .populate()
            .then((result) => res.status(200).send(result))
=======
            metIssue
            .find()
            .populate('createdBy', 'firstName lastName _id')
            .then((result) => {
                res.status(200).send(result)})
>>>>>>> de629dcbc125536e798dd27a4853241d7dca38d3
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const bmPostIssue = async (req, res) => {
        try {
            metIssue.create(req.body)
            .then((result) => {
                res.status(201).send(result)})
            .catch((error) => {
                res.status(500).send(error)});
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
