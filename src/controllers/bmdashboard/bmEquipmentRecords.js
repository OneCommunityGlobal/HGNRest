const mongoose = require('mongoose');
const { logException } = require('../../startup/logger');

const recordTypes = {
  updates: {
    path: 'updateRecord',
    creator: 'createdBy',
    fields: { condition: ['Good', 'Needs Repair', 'Out of Order'] },
  },
  purchases: {
    path: 'purchaseRecord',
    creator: 'requestedBy',
    fields: { priority: ['Low', 'Medium', 'High'], status: ['Pending', 'Approved', 'Rejected'] },
  },
};

module.exports = (Equipment) => async (req, res) => {
  const { equipmentId, kind, index } = req.params;
  if (!mongoose.Types.ObjectId.isValid(equipmentId) || !Object.hasOwn(recordTypes, kind)) {
    return res.status(400).json({ message: 'Invalid equipment or record type.' });
  }
  const { path, creator, fields } = recordTypes[kind];
  const values = Object.fromEntries(Object.keys(fields).map((field) => [field, req.body[field]]));
  if (Object.entries(fields).some(([field, choices]) => !choices.includes(values[field]))) {
    return res.status(400).json({ message: 'Choose valid values for all fields.' });
  }
  const timestamp = new Date();
  const actor = req.user.requestorId;
  const auditRows = (previous, number) =>
    Object.entries(values)
      .filter(([field, value]) => previous[field] !== value)
      .map(([field, value]) => ({
        timestamp,
        actor,
        field: `${kind === 'updates' ? 'Update' : 'Purchase'}${number ? ` #${number}` : ' added'}: ${field}`,
        oldValue: previous[field] ?? null,
        newValue: value,
      }));
  const conflict = () =>
    res.status(409).json({ message: 'This record changed. Reload before editing.' });
  try {
    if (index === undefined) {
      const result = await Equipment.updateOne(
        { _id: equipmentId },
        {
          $push: {
            [path]: { ...values, date: timestamp, [creator]: actor },
            auditHistory: { $each: auditRows({}) },
          },
        },
      );
      return res.sendStatus(result.n ? 201 : 404);
    }
    if (!/^\d+$/.test(index) || !Number.isSafeInteger(Number(index))) return res.sendStatus(404);
    const position = Number(index);
    const equipment = await Equipment.findById(equipmentId).select(path).lean();
    const record = equipment?.[path]?.[position];
    if (!record) return res.sendStatus(404);
    const original = req.body.original || {};
    if (
      (original.date ?? null) !== (record.date?.toISOString() ?? null) ||
      Object.keys(fields).some((field) => (original[field] ?? null) !== (record[field] ?? null))
    ) {
      return conflict();
    }
    const prefix = `${path}.${position}`;
    const filter = { _id: equipmentId, [`${prefix}.date`]: record.date ?? null };
    const set = {};
    Object.keys(fields).forEach((field) => {
      filter[`${prefix}.${field}`] = record[field] ?? null;
      set[`${prefix}.${field}`] = values[field];
    });
    const audit = auditRows(record, position + 1);
    if (!audit.length) return res.sendStatus(204);
    const result = await Equipment.updateOne(filter, {
      $set: set,
      $push: { auditHistory: { $each: audit } },
    });
    return result.n ? res.sendStatus(204) : conflict();
  } catch (error) {
    logException(error, 'bmEquipmentRecords');
    return res.status(500).json({ message: 'Unable to save the equipment record.' });
  }
};
