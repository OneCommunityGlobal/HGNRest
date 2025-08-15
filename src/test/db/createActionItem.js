const ActionItem = require('../../models/actionItem');

const createActionItem = async (assignedToId, createdById) => {
  const _actionItem = new ActionItem();

  _actionItem.description = 'Any description';
  _actionItem.assignedTo = assignedToId;
  _actionItem.createdBy = createdById;
  _actionItem.createdDateTime = new Date().toISOString();

  const actionItem = await _actionItem.save();
  return actionItem;
};

module.exports = createActionItem;
