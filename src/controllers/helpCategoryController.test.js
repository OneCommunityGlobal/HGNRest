const HelpCategory = require('../models/helpCategory');
const helpCategoryController = require('./helpCategoryController');

// Mock the HelpCategory model
jest.mock('../models/helpCategory');

describe('HelpCategoryController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock request
    mockReq = {
      body: {},
      params: {}
    };

    // Setup mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getAllHelpCategories', () => {
    it('should return all active help categories sorted by order', async () => {
      // Arrange
      const mockCategories = [
        { _id: '1', name: 'Getting Started', order: 1, isActive: true },
        { _id: '2', name: 'Advanced Features', order: 2, isActive: true },
        { _id: '3', name: 'Troubleshooting', order: 3, isActive: true }
      ];

      HelpCategory.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockCategories)
      });

      // Act
      await helpCategoryController.getAllHelpCategories(mockReq, mockRes);

      // Assert
      expect(HelpCategory.find).toHaveBeenCalledWith({ isActive: true });
      expect(HelpCategory.find().sort).toHaveBeenCalledWith({ order: 1 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockCategories);
    });

    it('should handle database errors when fetching help categories', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      HelpCategory.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(error)
      });

      // Act
      await helpCategoryController.getAllHelpCategories(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error fetching help categories',
        error: error.message
      });
    });
  });

  describe('createHelpCategory', () => {
    it.skip('should create a new help category with provided name and order', async () => {
      // Arrange
      const categoryData = {
        name: 'New Category',
        order: 5
      };
      mockReq.body = categoryData;

      const savedCategory = {
        _id: 'new-id',
        name: 'New Category',
        order: 5,
        isActive: true
      };

      const mockCategoryInstance = {
        save: jest.fn().mockResolvedValue(savedCategory)
      };

      HelpCategory.mockImplementation(() => mockCategoryInstance);

      // Act
      await helpCategoryController.createHelpCategory(mockReq, mockRes);

      // Assert
      expect(HelpCategory).toHaveBeenCalledWith({
        name: 'New Category',
        order: 5
      });
      expect(mockCategoryInstance.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(savedCategory);
    });
    it.skip('should create a help category with default order when not provided', async () => {
      // Arrange
      const categoryData = {
        name: 'Category Without Order'
      };
      mockReq.body = categoryData;

      const savedCategory = {
        _id: 'new-id',
        name: 'Category Without Order',
        order: 0,
        isActive: true
      };

      const mockCategoryInstance = {
        save: jest.fn().mockResolvedValue(savedCategory)
      };

      HelpCategory.mockImplementation(() => mockCategoryInstance);

      // Act
      await helpCategoryController.createHelpCategory(mockReq, mockRes);

      // Assert
      expect(HelpCategory).toHaveBeenCalledWith({
        name: 'Category Without Order',
        order: 0
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(savedCategory);
    });
    it.skip('should handle database errors when creating help category', async () => {
      // Arrange
      const categoryData = {
        name: 'Error Category',
        order: 1
      };
      mockReq.body = categoryData;

      const error = new Error('Validation failed');
      const mockCategoryInstance = {
        save: jest.fn().mockRejectedValue(error)
      };

      HelpCategory.mockImplementation(() => mockCategoryInstance);

      // Act
      await helpCategoryController.createHelpCategory(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error creating help category',
        error: error.message
      });
    });
  });

  describe('updateHelpCategory', () => {
    it('should update an existing help category successfully', async () => {
      // Arrange
      const categoryId = 'existing-id';
      const updateData = {
        name: 'Updated Category',
        order: 10,
        isActive: false
      };
      
      mockReq.params = { id: categoryId };
      mockReq.body = updateData;

      const updatedCategory = {
        _id: categoryId,
        name: 'Updated Category',
        order: 10,
        isActive: false
      };

      HelpCategory.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedCategory);

      // Act
      await helpCategoryController.updateHelpCategory(mockReq, mockRes);

      // Assert
      expect(HelpCategory.findByIdAndUpdate).toHaveBeenCalledWith(
        categoryId,
        updateData,
        { new: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedCategory);
    });

    it('should return 404 when help category is not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      const updateData = {
        name: 'Updated Category',
        order: 10
      };
      
      mockReq.params = { id: categoryId };
      mockReq.body = updateData;

      HelpCategory.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      // Act
      await helpCategoryController.updateHelpCategory(mockReq, mockRes);

      // Assert
      expect(HelpCategory.findByIdAndUpdate).toHaveBeenCalledWith(
        categoryId,
        updateData,
        { new: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Help category not found'
      });
    });

    it('should handle database errors when updating help category', async () => {
      // Arrange
      const categoryId = 'existing-id';
      const updateData = {
        name: 'Updated Category',
        order: 10
      };
      
      mockReq.params = { id: categoryId };
      mockReq.body = updateData;

      const error = new Error('Database update failed');
      HelpCategory.findByIdAndUpdate = jest.fn().mockRejectedValue(error);

      // Act
      await helpCategoryController.updateHelpCategory(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error updating help category',
        error: error.message
      });
    });
  });
});