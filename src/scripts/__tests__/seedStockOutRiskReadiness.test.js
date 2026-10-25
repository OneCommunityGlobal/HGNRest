// File version: 1.0.2
jest.mock('../../controllers/bmdashboard/bmMaterialsController', () => jest.fn());

const mongoose = require('mongoose');
const Project = require('../../models/bmdashboard/buildingProject');
const { buildingMaterial: Material } = require('../../models/bmdashboard/buildingInventoryItem');
const LegacyMaterial = require('../../models/bmdashboard/buildingMaterial');
const { materialType: MaterialType } = require('../../models/bmdashboard/buildingInventoryType');
const materialsController = require('../../controllers/bmdashboard/bmMaterialsController');
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

  it.each([false, true])(
    'checks all fixture IDs before writing to the live model (collision: %s)',
    async (collision) => {
      const previousEnv = process.env;
      process.env = {
        ...previousEnv,
        dbName: 'test',
        user: 'test',
        password: 'test',
        cluster: 'test.example',
      };
      const manager = new mongoose.Types.ObjectId();
      jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
      jest.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);
      jest.spyOn(Project, 'aggregate').mockResolvedValue([{ buildingManager: manager }]);
      [Project, MaterialType, Material, LegacyMaterial].forEach((Model) => {
        jest.spyOn(Model.collection, 'find').mockReturnValue({ toArray: async () => [] });
        jest.spyOn(Model, 'updateOne').mockResolvedValue({});
      });
      if (collision) {
        Material.collection.find.mockReturnValue({
          toArray: async () => [{ project: new mongoose.Types.ObjectId() }],
        });
      }
      const controller = {
        bmGetMaterialStockOutRisk: jest.fn(async (req, res) =>
          res.status(200).json({
            readiness: ['Ready', 'Partial', 'Not Configured', 'Partial', 'Partial', 'Partial'].map(
              (status, index) => ({ status, readyMaterialCount: [2, 1, 0, 0, 0, 0][index] }),
            ),
            chartData: [3, 3, 30].map((daysUntilStockOut) => ({ daysUntilStockOut })),
          }),
        ),
      };
      materialsController.mockReturnValue(controller);
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        if (collision) {
          await expect(run()).rejects.toThrow('A fixture ID belongs to another record');
          [Project, MaterialType, Material, LegacyMaterial].forEach((Model) => {
            expect(Model.updateOne).not.toHaveBeenCalled();
          });
          expect(controller.bmGetMaterialStockOutRisk).not.toHaveBeenCalled();
          return;
        }
        await run();
        expect(Material.modelName).toBe('material_item');
        expect(Material.collection.collectionName).toBe('buildingInventoryItems');
        expect(Material.updateOne).toHaveBeenCalledTimes(7);
        expect(LegacyMaterial.updateOne).not.toHaveBeenCalled();
        expect(materialsController).toHaveBeenCalledWith(Material);
        expect(controller.bmGetMaterialStockOutRisk.mock.calls[0][0].query).toEqual({
          projectIds: buildFixtures(manager)
            .projects.map((project) => project._id.toHexString())
            .join(','),
          includeReadiness: 'true',
        });
      } finally {
        process.env = previousEnv;
        log.mockRestore();
        jest.restoreAllMocks();
      }
    },
  );

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
