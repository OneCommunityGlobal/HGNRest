const mongoose = require('mongoose');
const { buildingEquipment: Equipment, buildingTool: Tool } = require('../buildingInventoryItem');

describe('routed equipment history schema', () => {
  test.each([false, true, 'yes', 'no', ''])(
    'history survives update casting and serialized readback (%p)',
    async (replacementRequired) => {
      const date = new Date('2026-11-02T12:00:00Z');
      const entry = {
        date,
        createdBy: new mongoose.Types.ObjectId(),
        condition: 'Out of Order',
        lastUsedBy: 'Volunteer',
        lastUsedFor: 'Tiling',
        replacementRequired,
        description: '',
        notes: 'Needs inspection',
        imageUrl: 'https://images.example.test/equipment/status.png',
      };
      const query = Equipment.findByIdAndUpdate(
        new mongoose.Types.ObjectId(),
        { $push: { updateRecord: entry } },
        { new: true, runValidators: true },
      );
      // Exercise the real query casting that previously stripped these fields.
      const cast = query._castUpdate(query.getUpdate()).$push.updateRecord;
      const stored = JSON.parse(
        JSON.stringify({
          _id: new mongoose.Types.ObjectId(),
          __t: 'equipment_item',
          condition: 'Like New',
          updateRecord: [cast],
        }),
      );
      const readBack = Equipment.hydrate(stored);
      await expect(readBack.validate()).resolves.toBeUndefined();
      expect(JSON.parse(JSON.stringify(readBack.updateRecord[0]))).toMatchObject(
        JSON.parse(JSON.stringify(entry)),
      );
      expect(readBack.updateRecord[0].date).toBeInstanceOf(Date);
      expect(readBack.updateRecord[0].replacementRequired).toBe(replacementRequired);
      expect(readBack.condition).toBe('Like New');
    },
  );

  test('supports legacy history with no new fields', async () => {
    const doc = new Equipment({ updateRecord: [{ condition: 'Good' }] });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.updateRecord[0].replacementRequired).toBeUndefined();
  });

  test.each([
    { condition: 'Working well' },
    { replacementRequired: {} },
    { replacementRequired: 'maybe' },
    { notes: 'x'.repeat(2001) },
  ])('schema validation rejects %p', async (fields) => {
    const doc = new Equipment({ updateRecord: [{ condition: 'Good', ...fields }] });
    await expect(doc.validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });

  test('retains routed discriminator and root condition contracts', () => {
    expect(Equipment.collection.name).toBe('buildingInventoryItems');
    expect(Equipment.schema.discriminatorMapping.value).toBe('equipment_item');
    expect(Tool.schema.discriminatorMapping.value).toBe('tool_item');
    expect(Equipment.schema.path('condition').enumValues).not.toContain('Out of Order');
    expect(Equipment.schema.path('updateRecord').schema.path('condition').enumValues).toEqual([
      'Good',
      'Needs Repair',
      'Out of Order',
    ]);
  });
});
