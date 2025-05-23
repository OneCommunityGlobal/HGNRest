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

    const bmPostIssue = async (req, res) => {
        try {
            buildingIssue.create(req.body)
            .then((result) => {
                res.status(201).send(result)})
            .catch((error) => {
                res.status(500).send(error)});
        } catch (err) {
            res.json(err);
        }
    };
    const bmUpdateIssue = async (req, res) => {
        try {

            const updates = req.body;

            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ message: 'Invalid update data.' });
            }

            buildingIssue.findByIdAndUpdate(
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

    const bmDeleteIssue = (req, res) => {
        const { id } = req.params;
      
        buildingIssue.findByIdAndDelete(id)
          .then((deletedIssue) => {
            if (!deletedIssue) {
              return res.status(404).json({ message: 'Issue not found.' });
            }
            res.json({ message: 'Issue deleted successfully.' });
          })
          .catch((err) => res.status(500).json({ error: err.message }));
      };

    return { bmGetIssue, bmPostIssue, bmUpdateIssue, bmDeleteIssue };
};

module.exports = bmIssueController;
