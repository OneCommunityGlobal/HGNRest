// File version: 1.0.0
const mongoose = require('mongoose');
const { buildFixtures, run } = require('../seedStockOutRiskReadiness');

describe('stock-out readiness QA fixtures', () => {
  it('creates isolated, consistent stock and consumption fixtures', () => {
    const manager = new mongoose.Types.ObjectId();
    const { projects, types, materials } = buildFixtures(manager);
    expect(projects).toHaveLength(6);
    expect(types).toHaveLength(2);
    expect(materials).toHaveLength(7);
    expect(
      new Set([...projects, ...types, ...materials].map((doc) => doc._id.toString())).size,
    ).toBe(15);
    projects.forEach((project) => {
      expect(project.name).toMatch(/^\[Stock Risk QA 5709\]/);
      expect(project.buildingManager).toBe(manager);
      expect(project.isActive).toBe(true);
    });
    materials.forEach((material) => {
      expect(material.stockBought - material.stockUsed - material.stockWasted).toBe(
        material.stockAvailable,
      );
      expect(projects.some((project) => project._id.equals(material.project))).toBe(true);
    });
    expect(materials.filter((doc) => doc.project.equals(projects[2]._id))).toHaveLength(0);
    expect(materials.filter((doc) => !doc.itemType)).toHaveLength(1);
  });

  it('refuses a production database before connecting', async () => {
    const previousDatabase = process.env.dbName;
    const connect = jest.spyOn(mongoose, 'connect');
    process.env.dbName = 'production';
    try {
      await expect(run()).rejects.toThrow('production seeding is refused');
      expect(connect).not.toHaveBeenCalled();
    } finally {
      if (previousDatabase === undefined) delete process.env.dbName;
      else process.env.dbName = previousDatabase;
      connect.mockRestore();
    }
  });
});
