const mongoose = require('mongoose');
const BuildingTool = require('../buildingTool');

describe('BM dashboard record date defaults', () => {
  const oid = () => new mongoose.Types.ObjectId();

  it('uses a function default (evaluated per record, not once at startup)', () => {
    const purchaseSchema = BuildingTool.schema.path('purchaseRecord').schema;
    expect(typeof purchaseSchema.path('date').defaultValue).toBe('function');
  });

  it('dates a new purchase record at the time it is created', () => {
    const before = Date.now();
    const doc = new BuildingTool({
      itemType: oid(),
      project: oid(),
      purchaseRecord: [{ priority: 'Low', quantity: 1 }],
    });
    const date = doc.purchaseRecord[0].date.getTime();
    expect(date).toBeGreaterThanOrEqual(before);
    expect(date).toBeLessThanOrEqual(Date.now());
  });

  it('gives update and log records their own creation time too', () => {
    const before = Date.now();
    const doc = new BuildingTool({
      itemType: oid(),
      project: oid(),
      updateRecord: [{ condition: 'Good' }],
      logRecord: [{ type: 'Check In' }],
    });
    expect(doc.updateRecord[0].date.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.logRecord[0].date.getTime()).toBeGreaterThanOrEqual(before);
  });
});
