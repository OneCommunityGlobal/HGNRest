// Mock external dependencies
jest.mock('../../utilities/emailSender');
jest.mock('../../models/BlueSquareEmailAssignment', () => ({
  find: jest.fn().mockImplementation(() => ({
    populate: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue([
        {
          email: 'bcc-test@example.com',
          assignedTo: { isActive: true },
        },
      ]),
    })),
  })),
}));

const warningsHelper = require('../warningsHelper');
const emailSender = require('../../utilities/emailSender');

describe('warningsHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ========================================================================
       1. getOrdinal
       ======================================================================== */
  describe('getOrdinal', () => {
    it('should correctly format single digit ordinals', () => {
      expect(warningsHelper.getOrdinal(1)).toBe('1st');
      expect(warningsHelper.getOrdinal(2)).toBe('2nd');
      expect(warningsHelper.getOrdinal(3)).toBe('3rd');
      expect(warningsHelper.getOrdinal(4)).toBe('4th');
    });

    it('should correctly format teen ordinals (11th, 12th, 13th)', () => {
      expect(warningsHelper.getOrdinal(11)).toBe('11th');
      expect(warningsHelper.getOrdinal(12)).toBe('12th');
      expect(warningsHelper.getOrdinal(13)).toBe('13th');
    });

    it('should correctly format larger numbers', () => {
      expect(warningsHelper.getOrdinal(21)).toBe('21st');
      expect(warningsHelper.getOrdinal(22)).toBe('22nd');
      expect(warningsHelper.getOrdinal(23)).toBe('23rd');
      expect(warningsHelper.getOrdinal(100)).toBe('100th');
      expect(warningsHelper.getOrdinal(101)).toBe('101st');
      expect(warningsHelper.getOrdinal(111)).toBe('111th');
    });
  });

  /* ========================================================================
       2. getColorIndex & sortByColorAndDate
       ======================================================================== */
  describe('getColorIndex', () => {
    it('should return correct indices for blue, yellow, red', () => {
      expect(warningsHelper.getColorIndex('blue')).toBe(0);
      expect(warningsHelper.getColorIndex('yellow')).toBe(1);
      expect(warningsHelper.getColorIndex('red')).toBe(2);
      expect(warningsHelper.getColorIndex('unknown')).toBe(-1);
    });
  });

  describe('sortByColorAndDate', () => {
    it('should sort warnings primarily by color order (blue < yellow < red)', () => {
      const warningRed = { color: 'red', date: '2026-01-01' };
      const warningBlue = { color: 'blue', date: '2026-01-01' };
      const warningYellow = { color: 'yellow', date: '2026-01-01' };

      const warnings = [warningRed, warningBlue, warningYellow];
      warnings.sort(warningsHelper.sortByColorAndDate);

      expect(warnings).toEqual([warningBlue, warningYellow, warningRed]);
    });

    it('should sort warnings by date when colors are equal', () => {
      const olderBlue = { color: 'blue', date: '2026-01-01' };
      const newerBlue = { color: 'blue', date: '2026-05-01' };

      const warnings = [newerBlue, olderBlue];
      warnings.sort(warningsHelper.sortByColorAndDate);

      expect(warnings).toEqual([olderBlue, newerBlue]);
    });
  });

  /* ========================================================================
       3. filterWarnings
       ======================================================================== */
  describe('filterWarnings', () => {
    const warningDescriptions = [
      { warningTitle: 'Title A', abbreviation: 'TA', order: 1 },
      { warningTitle: 'Title B', abbreviation: 'TB', order: 2 },
    ];

    it('should group warnings by description and structure completedData', () => {
      const warnings = [
        { description: 'Title A', color: 'blue', date: '2026-01-01' },
        { description: 'Title B', color: 'yellow', date: '2026-01-02' },
      ];

      const result = warningsHelper.filterWarnings(warningDescriptions, warnings);

      expect(result.completedData).toHaveLength(2);
      expect(result.completedData[0].title).toBe('Title A');
      expect(result.completedData[0].warnings).toHaveLength(1);
      expect(result.completedData[1].title).toBe('Title B');
      expect(result.completedData[1].warnings).toHaveLength(1);
    });

    it('should set sendEmail to "issue warning" when 3+ yellow warnings match iconId', () => {
      const warnings = [
        { description: 'Title A', iconId: 'icon-123', color: 'yellow' },
        { description: 'Title A', iconId: 'icon-456', color: 'blue' },
        { description: 'Title A', iconId: 'icon-123', color: 'yellow' },
      ];

      const result = warningsHelper.filterWarnings(
        warningDescriptions,
        warnings,
        'icon-123',
        'yellow',
      );

      expect(result.sendEmail).toBe('issue warning');
      expect(result.size).toBe(3);
    });

    it('should set sendEmail to "issue blue square" when red warning matches iconId', () => {
      const warnings = [{ description: 'Title A', iconId: 'icon-999', color: 'red' }];

      const result = warningsHelper.filterWarnings(
        warningDescriptions,
        warnings,
        'icon-999',
        'red',
      );

      expect(result.sendEmail).toBe('issue blue square');
      expect(result.size).toBe(1);
    });

    describe('issueBlueSquare configurations', () => {
      const warnings = [
        { description: 'Blu Sq Rmvd - For No Summary', color: 'blue' },
        { description: 'Blu Sq Rmvd - Hrs Close Enoug', color: 'blue' },
      ];

      it('should set sendEmail to "issue two warnings blue square" when blueSquareCount is 2', () => {
        const issueBlueSquare = {
          'Blu Sq Rmvd - For No Summary': true,
          'Blu Sq Rmvd - Hrs Close Enoug': true,
        };

        const result = warningsHelper.filterWarnings(
          warningDescriptions,
          warnings,
          null,
          null,
          issueBlueSquare,
        );

        expect(result.sendEmail).toBe('issue two warnings blue square');
        expect(result.size).toEqual({
          'Removed Blue Square for No Summary': 1,
          'Removed Blue Square for Hours Close Enough': 1,
        });
      });

      it('should set sendEmail to "issue blue square and warning" when blueSquareCount is 1 for No Summary', () => {
        const issueBlueSquare = {
          'Blu Sq Rmvd - For No Summary': true,
          'Blu Sq Rmvd - Hrs Close Enoug': false,
        };

        const result = warningsHelper.filterWarnings(
          warningDescriptions,
          warnings,
          null,
          null,
          issueBlueSquare,
        );

        expect(result.sendEmail).toBe('issue blue square and warning');
      });

      it('should set sendEmail to "issue warning and blue square" when blueSquareCount is 1 for Hours Close Enough', () => {
        const issueBlueSquare = {
          'Blu Sq Rmvd - For No Summary': false,
          'Blu Sq Rmvd - Hrs Close Enoug': true,
        };

        const result = warningsHelper.filterWarnings(
          warningDescriptions,
          warnings,
          null,
          null,
          issueBlueSquare,
        );

        expect(result.sendEmail).toBe('issue warning and blue square');
      });

      it('should set sendEmail to "issue two warnings" when blueSquareCount is 0', () => {
        const issueBlueSquare = {
          'Blu Sq Rmvd - For No Summary': false,
          'Blu Sq Rmvd - Hrs Close Enoug': false,
        };

        const result = warningsHelper.filterWarnings(
          warningDescriptions,
          warnings,
          null,
          null,
          issueBlueSquare,
        );

        expect(result.sendEmail).toBe('issue two warnings');
      });
    });
  });

  /* ========================================================================
       4. sendEmailToUser
       ======================================================================== */
  describe('sendEmailToUser', () => {
    const userAssignedWarning = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    };
    const monitorData = {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
    };
    const adminEmails = ['manager@example.com', 'lead@example.com'];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should format emails correctly for "issue warning"', async () => {
      await warningsHelper.sendEmailToUser(
        'issue warning',
        'Test Warning Description',
        userAssignedWarning,
        monitorData,
        3,
        adminEmails,
      );

      expect(emailSender).toHaveBeenCalledWith(
        'jane@example.com',
        "IMPORTANT: Please read this email and take note so you don't get a blue square",
        expect.stringContaining('3rd'),
        null,
        'manager@example.com,lead@example.com',
        'jane@example.com',
        null, // bccList is null for "issue warning"
      );
    });

    it('should format emails correctly for "issue blue square" and attach BCC list', async () => {
      await warningsHelper.sendEmailToUser(
        'issue blue square',
        'Test Warning Description',
        userAssignedWarning,
        monitorData,
        4,
        adminEmails,
      );

      expect(emailSender).toHaveBeenCalledWith(
        'jane@example.com',
        'IMPORTANT: You have been issued a blue square',
        expect.stringContaining('4th'),
        null,
        'manager@example.com,lead@example.com',
        'jane@example.com',
        ['bcc-test@example.com'], // active BCC filtered
      );
    });

    it('should calculate ordinal from size object for "issue warning and blue square"', async () => {
      const sizeObject = {
        'Removed Blue Square for Hours Close Enough': 2,
        'Removed Blue Square for No Summary': 1,
      };

      await warningsHelper.sendEmailToUser(
        'issue warning and blue square',
        'Test Warning',
        userAssignedWarning,
        monitorData,
        sizeObject,
        adminEmails,
      );

      expect(emailSender).toHaveBeenCalledWith(
        'jane@example.com',
        'IMPORTANT: You have been issued a blue square and a warning',
        expect.stringContaining('2nd'), // Uses size['Removed Blue Square for Hours Close Enough']
        null,
        adminEmails.toString(),
        'jane@example.com',
        ['bcc-test@example.com'],
      );
    });

    it('should calculate ordinal from size object for "issue blue square and warning"', async () => {
      const sizeObject = {
        'Removed Blue Square for Hours Close Enough': 1,
        'Removed Blue Square for No Summary': 3,
      };

      await warningsHelper.sendEmailToUser(
        'issue blue square and warning',
        'Test Warning',
        userAssignedWarning,
        monitorData,
        sizeObject,
        adminEmails,
      );

      expect(emailSender).toHaveBeenCalledWith(
        'jane@example.com',
        'IMPORTANT: You have been issued a blue square and a warning',
        expect.stringContaining('3rd'), // Uses size['Removed Blue Square for No Summary']
        null,
        adminEmails.toString(),
        'jane@example.com',
        ['bcc-test@example.com'],
      );
    });

    it('should use Math.max for size object on other sendEmail types', async () => {
      const sizeObject = {
        'Removed Blue Square for Hours Close Enough': 5,
        'Removed Blue Square for No Summary': 2,
      };

      await warningsHelper.sendEmailToUser(
        'issue two warnings blue square',
        'Test Warning',
        userAssignedWarning,
        monitorData,
        sizeObject,
        adminEmails,
      );

      expect(emailSender).toHaveBeenCalledWith(
        'jane@example.com',
        'IMPORTANT: You have been issued a blue square',
        expect.stringContaining('5th'), // Math.max(5, 2)
        null,
        adminEmails.toString(),
        'jane@example.com',
        ['bcc-test@example.com'],
      );
    });
  });
});
