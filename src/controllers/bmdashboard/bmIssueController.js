const bmIssueController = function (metIssue, injuryIssue) {
    // Met Issue
    const bmGetMetIssue = async (req, res) => {
        try {
            metIssue
            .find()
            .populate('createdBy', 'firstName lastName _id')
            .then((result) => {
                res.status(200).send(result)})
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.status(500).json(err);
        }
    };

    const bmPostMetIssue = async (req, res) => {
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

    // Injury Issue
    const bmPostInjuryIssue = async (req, res) => {
        try {
            const issue = await injuryIssue.create(req.body);
            return res.status(201).json(issue);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    };
    
    // Fetch all injury issues (with assigned user’s name)
    const bmGetInjuryIssue = async (req, res) => {
        try {
            const issues = await injuryIssue
                .find()
                .populate('assignedTo', 'firstName lastName _id');
            return res.status(200).json(issues);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Delete an issue by its ID (_id)
    const bmDeleteInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await injuryIssue.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ message: 'Issue not found' });
            }
            return res.status(200).json({ message: 'Deleted successfully', deleted });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Rename (update the name) of an issue by its ID
    const bmRenameInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params; 
            const { newName } = req.body;
            if (!newName) {
                return res.status(400).json({ message: 'newName is required' });
            }
            const updated = await injuryIssue.findByIdAndUpdate(
                id,
                { name: newName },
                { new: true, runValidators: true }
            );
            if (!updated) {
                return res.status(404).json({ message: 'Issue not found' });
            }
            return res.status(200).json({ message: 'Renamed successfully', updated });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Copy an existing issue by its ID
    const bmCopyInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params;
            const original = await injuryIssue.findById(id).lean();
            if (!original) {
                return res.status(404).json({ message: 'Issue not found' });
            }
    
            // Build copy data
            const copyData = {
                projectId:original.projectId,
                name: `${original.name} (Copy)`,
                openDate: Date.now(),
                category: original.category,
                assignedTo: original.assignedTo,
                totalCost: original.totalCost
            };
    
            const copy = await injuryIssue.create(copyData);
            return res.status(201).json({ message: 'Copied successfully', copy });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };

    return { bmGetMetIssue, bmPostMetIssue,bmPostInjuryIssue,bmGetInjuryIssue, bmDeleteInjuryIssue, bmRenameInjuryIssue, bmCopyInjuryIssue };
};

module.exports = bmIssueController;
