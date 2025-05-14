const { google } = require('googleapis');
const googleSheetService = require('../services/automation/googleSheetService');
require('dotenv').config();

// Helper functions for test setup
const createMockSheetData = (values) => ({
  data: { values },
});

const createMockMember = (overrides = {}) => ({
  name: 'Test User',
  email: 'test@example.com',
  github: 'testuser',
  dropboxFolder: 'test-folder',
  ...overrides,
});

describe('Google Sheet Service Tests', () => {
  let mockSheets;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock Google Sheets API
    const mockGoogleSheets = {
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn(),
          append: jest.fn(),
        },
      },
    };

    // Mock the entire google object
    jest.spyOn(google, 'sheets').mockReturnValue(mockGoogleSheets);
    mockSheets = mockGoogleSheets.spreadsheets.values;

    // Mock environment variables
    process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: 'test-private-key',
      client_email: 'test@test-project.iam.gserviceaccount.com',
      client_id: 'test-client-id',
    });

    // Initialize Google Sheets API
    googleSheetService._initializeGoogleSheets();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAllMembers', () => {
    it('should successfully fetch all members', async () => {
      const mockData = createMockSheetData([
        ['John Doe', 'john@example.com', 'johndoe', 'Active', '2024-03-20'],
        ['Jane Smith', 'jane@example.com', 'janesmith', 'Active', '2024-03-20'],
      ]);

      mockSheets.get.mockResolvedValue(mockData);

      const members = await googleSheetService.getAllMembers();

      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        github: 'johndoe',
        status: 'Active',
        lastUpdated: '2024-03-20',
      });
    });

    it('should handle empty sheet', async () => {
      mockSheets.get.mockResolvedValue(createMockSheetData([]));

      const members = await googleSheetService.getAllMembers();

      expect(members).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      mockSheets.get.mockRejectedValue(new Error('API Error'));

      await expect(googleSheetService.getAllMembers()).rejects.toThrow(
        'Error fetching members from Google Sheet',
      );
    });
  });

  describe('addNewMember', () => {
    it('should successfully add a new member', async () => {
      const newMember = createMockMember();

      mockSheets.get.mockResolvedValue(createMockSheetData([]));
      mockSheets.append.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });

      const result = await googleSheetService.addNewMember(newMember);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Added Test User to sheet');
    });

    it('should handle API errors', async () => {
      const newMember = createMockMember();

      mockSheets.get.mockRejectedValue(new Error('API Error'));

      const result = await googleSheetService.addNewMember(newMember);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('should validate required fields', async () => {
      const invalidMember = createMockMember({ email: undefined });

      const result = await googleSheetService.addNewMember(invalidMember);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should handle duplicate email addresses', async () => {
      const existingMember = createMockMember({ email: 'existing@example.com' });

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Existing User', 'existing@example.com', 'existinguser', 'Active', '2024-03-20'],
        ]),
      );

      const result = await googleSheetService.addNewMember(existingMember);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email already exists');
    });

    it('should handle special characters in member data', async () => {
      const memberWithSpecialChars = createMockMember({
        name: 'Test User (Special)',
        email: 'test+special@example.com',
        github: 'test-user-special',
        dropboxFolder: 'test-folder-special',
      });

      mockSheets.get.mockResolvedValue(createMockSheetData([]));
      mockSheets.append.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });

      const result = await googleSheetService.addNewMember(memberWithSpecialChars);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Added Test User (Special) to sheet');
    });

    it('should handle long member data', async () => {
      const memberWithLongData = createMockMember({
        name: 'A'.repeat(100),
        github: 'B'.repeat(50),
        dropboxFolder: 'C'.repeat(50),
      });

      mockSheets.get.mockResolvedValue(createMockSheetData([]));
      mockSheets.append.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });

      const result = await googleSheetService.addNewMember(memberWithLongData);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Added ${memberWithLongData.name} to sheet`);
    });
  });

  describe('batchAddMembers', () => {
    it('should successfully add multiple members', async () => {
      const members = [
        createMockMember({ name: 'User 1', email: 'user1@example.com' }),
        createMockMember({ name: 'User 2', email: 'user2@example.com' }),
      ];

      mockSheets.get.mockResolvedValue(createMockSheetData([]));
      mockSheets.append.mockResolvedValue({ data: { updates: { updatedRows: 1 } } });

      const result = await googleSheetService.batchAddMembers(members);

      expect(result.success).toBe(true);
      expect(result.progress.progress).toBe(100);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should handle partial failures', async () => {
      const members = [
        createMockMember({ name: 'User 1', email: 'user1@example.com' }),
        createMockMember({ name: 'User 2', email: 'user2@example.com' }),
      ];

      mockSheets.get.mockResolvedValue(createMockSheetData([]));
      mockSheets.append
        .mockResolvedValueOnce({ data: { updates: { updatedRows: 1 } } })
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await googleSheetService.batchAddMembers(members);

      expect(result.success).toBe(false);
      expect(result.progress.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('updateMemberStatus', () => {
    it('should successfully update member status', async () => {
      const member = createMockMember();

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Test User', 'test@example.com', 'testuser', 'Active', '2024-03-20'],
        ]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.updateMemberStatus(member, 'Inactive');

      expect(result.success).toBe(true);
      expect(result.message).toBe("Updated Test User's status to Inactive");
    });

    it('should handle member not found', async () => {
      const member = createMockMember();

      mockSheets.get.mockResolvedValue(createMockSheetData([]));

      const result = await googleSheetService.updateMemberStatus(member, 'Inactive');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Member not found in sheet');
    });

    it('should validate status values', async () => {
      const member = createMockMember();

      const result = await googleSheetService.updateMemberStatus(member, 'InvalidStatus');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status value');
    });

    it('should handle case-insensitive status values', async () => {
      const member = createMockMember();

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Test User', 'test@example.com', 'testuser', 'Active', '2024-03-20'],
        ]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.updateMemberStatus(member, 'inactive');

      expect(result.success).toBe(true);
      expect(result.message).toBe("Updated Test User's status to Inactive");
    });

    it('should handle status update to same value', async () => {
      const member = createMockMember();

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Test User', 'test@example.com', 'testuser', 'Active', '2024-03-20'],
        ]),
      );

      const result = await googleSheetService.updateMemberStatus(member, 'Active');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Status already set to Active');
    });

    it('should update lastUpdated timestamp', async () => {
      const member = createMockMember();

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Test User', 'test@example.com', 'testuser', 'Active', '2024-03-20'],
        ]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.updateMemberStatus(member, 'Inactive');

      expect(result.success).toBe(true);
      expect(mockSheets.update).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.objectContaining({
            values: expect.arrayContaining([
              expect.arrayContaining([
                expect.any(String), // Status
                expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // Timestamp
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('batchUpdateMemberStatuses', () => {
    it('should successfully update multiple member statuses', async () => {
      const members = [
        createMockMember({ name: 'User 1', email: 'user1@example.com' }),
        createMockMember({ name: 'User 2', email: 'user2@example.com' }),
      ];

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['User 1', 'user1@example.com', 'user1', 'Active', '2024-03-20'],
          ['User 2', 'user2@example.com', 'user2', 'Active', '2024-03-20'],
        ]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.batchUpdateMemberStatuses(members, 'Inactive');

      expect(result.success).toBe(true);
      expect(result.progress.progress).toBe(100);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should handle partial failures', async () => {
      const members = [
        createMockMember({ name: 'User 1', email: 'user1@example.com' }),
        createMockMember({ name: 'User 2', email: 'user2@example.com' }),
      ];

      mockSheets.get.mockResolvedValue(
        createMockSheetData([['User 1', 'user1@example.com', 'user1', 'Active', '2024-03-20']]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.batchUpdateMemberStatuses(members, 'Inactive');

      expect(result.success).toBe(false);
      expect(result.progress.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('rollbackChanges', () => {
    it('should successfully rollback add operations', async () => {
      const operations = [
        {
          type: 'add',
          member: createMockMember(),
        },
      ];

      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Test User', 'test@example.com', 'testuser', 'Active', '2024-03-20'],
        ]),
      );

      mockSheets.update.mockResolvedValue({ data: { updatedRows: 1 } });

      const result = await googleSheetService.rollbackChanges(operations);

      expect(result.success).toBe(true);
      expect(result.progress.progress).toBe(100);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
    });

    it('should handle rollback failures', async () => {
      const operations = [
        {
          type: 'add',
          member: createMockMember(),
        },
      ];

      mockSheets.get.mockRejectedValue(new Error('API Error'));

      const result = await googleSheetService.rollbackChanges(operations);

      expect(result.success).toBe(false);
      expect(result.progress.failed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false);
    });
  });

  describe('getInactiveMembers', () => {
    it('should return only inactive members', async () => {
      mockSheets.get.mockResolvedValue(
        createMockSheetData([
          ['Active User', 'active@example.com', 'activeuser', 'Active', '2024-03-20'],
          ['Inactive User', 'inactive@example.com', 'inactiveuser', 'Inactive', '2024-03-20'],
          ['Another Inactive', 'another@example.com', 'anotheruser', 'Inactive', '2024-03-20'],
        ]),
      );

      const inactiveMembers = await googleSheetService.getInactiveMembers();

      expect(inactiveMembers).toHaveLength(2);
      expect(inactiveMembers.every((member) => member.status === 'Inactive')).toBe(true);
    });

    it('should handle empty sheet', async () => {
      mockSheets.get.mockResolvedValue(createMockSheetData([]));

      const inactiveMembers = await googleSheetService.getInactiveMembers();

      expect(inactiveMembers).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      mockSheets.get.mockRejectedValue(new Error('API Error'));

      await expect(googleSheetService.getInactiveMembers()).rejects.toThrow(
        'Error fetching inactive members',
      );
    });
  });
});
