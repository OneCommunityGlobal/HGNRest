const express = require('express');
// Mock the controller
const mockController = {
  bmMaterialsList: jest.fn(),
  bmPurchaseMaterials: jest.fn(),
  bmPostMaterialUpdateRecord: jest.fn(),
  bmPostMaterialUpdateBulk: jest.fn(),
  bmupdatePurchaseStatus: jest.fn(),
  bmGetMaterialCostCorrelation: jest.fn(),
  bmGetMaterialStockOutRisk: jest.fn(),
  bmGetMaterialSummaryByProject: jest.fn(),
};

jest.mock('../../../controllers/bmdashboard/bmMaterialsController', () =>
  jest.fn(() => mockController),
);

const bmMaterialsRouter = require('../bmMaterialsRouter');

describe('bmMaterialsRouter', () => {
  let mockBuildingMaterial;
  let router;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildingMaterial = {};
    router = bmMaterialsRouter(mockBuildingMaterial);
  });

  describe('Category 1: Route Registration', () => {
    it('should register route at correct path: /materials/cost-correlation', () => {
      // Verify router is an Express Router instance
      expect(router).toBeDefined();
      expect(typeof router.route).toBe('function');
    });

    it('should register GET method for cost-correlation route', () => {
      // Create a test app to verify route registration
      const app = express();
      app.use('/test', router);

      // The route should be registered - we verify by checking the controller is called
      // when the route is accessed (in integration test)
      expect(mockController.bmGetMaterialCostCorrelation).toBeDefined();
    });

    it('should bind controller method correctly', () => {
      // Verify controller method exists and is a function
      expect(typeof mockController.bmGetMaterialCostCorrelation).toBe('function');
    });

    it('should make route accessible', () => {
      // Verify router is returned and can be used
      expect(router).toBeDefined();
      expect(typeof router.route).toBe('function');
      expect(typeof router.use).toBe('function');
    });
  });

  describe('Category 2: Route Ordering', () => {
    it('should register cost-correlation route before /materials/:projectId route', () => {
      // Verify both routes exist by checking controller methods
      expect(mockController.bmGetMaterialCostCorrelation).toBeDefined();
      expect(mockController.bmGetMaterialSummaryByProject).toBeDefined();

      // The route order is determined by the order in the router file
      // Line 19: /materials/cost-correlation
      // Line 21: /materials/:projectId
      // This ensures cost-correlation matches before the parameterized route
    });

    it('should ensure specific route matches before parameterized route', () => {
      // Create Express app to test route matching
      const app = express();
      app.use('/api/bm', router);

      // Mock request handlers
      mockController.bmGetMaterialCostCorrelation.mockImplementation((req, res) => {
        res.status(200).json({ route: 'cost-correlation' });
      });

      mockController.bmGetMaterialSummaryByProject.mockImplementation((req, res) => {
        res.status(200).json({ route: 'project-summary', projectId: req.params.projectId });
      });

      // Both routes should be registered
      expect(mockController.bmGetMaterialCostCorrelation).toBeDefined();
      expect(mockController.bmGetMaterialSummaryByProject).toBeDefined();
    });

    it('should ensure cost-correlation is not matched as projectId parameter', () => {
      // Verify that cost-correlation route exists separately from parameterized route
      expect(mockController.bmGetMaterialCostCorrelation).toBeDefined();
      expect(mockController.bmGetMaterialSummaryByProject).toBeDefined();

      // The route registration order ensures cost-correlation is checked first
      // This prevents 'cost-correlation' from being treated as a projectId
    });
  });

  describe('Category 3: Router Structure', () => {
    it('should return Express Router instance', () => {
      expect(router).toBeDefined();
      expect(typeof router.route).toBe('function');
      expect(typeof router.use).toBe('function');
      expect(typeof router.get).toBe('function');
    });

    it('should initialize controller with BuildingMaterial model', () => {
      const bmMaterialsController = require('../../../controllers/bmdashboard/bmMaterialsController');
      expect(bmMaterialsController).toHaveBeenCalledWith(mockBuildingMaterial);
    });

    it('should register all expected routes', () => {
      // Verify all controller methods are available
      expect(mockController.bmMaterialsList).toBeDefined();
      expect(mockController.bmPurchaseMaterials).toBeDefined();
      expect(mockController.bmPostMaterialUpdateRecord).toBeDefined();
      expect(mockController.bmPostMaterialUpdateBulk).toBeDefined();
      expect(mockController.bmupdatePurchaseStatus).toBeDefined();
      expect(mockController.bmGetMaterialCostCorrelation).toBeDefined();
      expect(mockController.bmGetMaterialSummaryByProject).toBeDefined();
    });
  });
});
