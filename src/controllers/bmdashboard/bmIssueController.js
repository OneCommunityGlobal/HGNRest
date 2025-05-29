const bmIssueController = function (buildingIssue) {
    const bmGetIssue = async (req, res) => {
        try {
            buildingIssue
            .find({status: 'open'})
            .populate()
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };
    return { bmGetIssue };
};

module.exports = bmIssueController;
