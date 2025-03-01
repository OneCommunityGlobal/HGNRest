const bmIssueController = function (metIssue) {
    const bmGetIssue = async (req, res) => {
        try {
            metIssue
            .find()
            .populate('createdBy', 'firstName lastName _id')
            .then((result) => {
                res.status(200).send(result)})
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

    return { bmGetIssue, bmPostIssue };
};

module.exports = bmIssueController;
