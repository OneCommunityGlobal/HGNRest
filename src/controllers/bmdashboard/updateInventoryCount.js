const mongoose = require('mongoose');

module.exports = (Model, idParam) => async (req, res) => {
  const { count, date, condition, projectId, expectedCount } = req.body;
  const createdBy = req.body.requestor?.requestorId;
  if (!createdBy) return res.status(401).json({ message: 'Please sign in again.' });
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !mongoose.Types.ObjectId.isValid(req.params[idParam]) ||
    !mongoose.Types.ObjectId.isValid(projectId) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    date > new Date().toLocaleDateString('en-CA') ||
    !['Good', 'Needs Repair', 'Out of Order'].includes(condition)
  ) {
    return res
      .status(400)
      .json({ message: 'Provide a valid item, project, whole-number count, date and condition.' });
  }
  try {
    const item = await Model.findById(req.params[idParam]);
    if (!item || String(item.project) !== projectId) {
      return res.status(404).json({ message: 'Item not found in this project.' });
    }
    const previousCount = item.count ?? null;
    if (expectedCount !== previousCount) {
      return res
        .status(409)
        .json({ message: 'The count changed. Refresh and review the latest count.' });
    }
    const updated = await Model.findOneAndUpdate(
      { _id: item._id, count: previousCount },
      {
        $set: { count },
        $push: {
          countHistory: {
            date: parsedDate,
            createdBy,
            condition,
            previousCount,
            count,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated)
      return res.status(409).json({ message: 'The count changed. Refresh and try again.' });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save the count. Please try again.' });
  }
};
