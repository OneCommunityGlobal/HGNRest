jest.mock('./permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('./permissions');
const {
  canManageJobForms,
  canAccessJobFormManagement,
  canCreateFormQuestions,
  canEditFormQuestions,
  canDeleteFormQuestions,
} = require('./jobFormPermissions');

const requestor = { requestorId: 'user1', role: 'Administrator' };

describe('jobFormPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('canManageJobForms checks manageJobForms only', async () => {
    hasPermission.mockResolvedValueOnce(true);
    await expect(canManageJobForms(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'manageJobForms');
  });

  it('canCreateFormQuestions checks createFormQuestions only', async () => {
    hasPermission.mockResolvedValueOnce(true);
    await expect(canCreateFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'createFormQuestions');
  });

  it('canEditFormQuestions checks editFormQuestions only', async () => {
    hasPermission.mockResolvedValueOnce(true);
    await expect(canEditFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'editFormQuestions');
  });

  it('canDeleteFormQuestions checks deleteFormQuestions only', async () => {
    hasPermission.mockResolvedValueOnce(true);
    await expect(canDeleteFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'deleteFormQuestions');
  });

  it('canAccessJobFormManagement allows any job form permission', async () => {
    hasPermission
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(canAccessJobFormManagement(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledTimes(4);
  });

  it('canAccessJobFormManagement returns false when no permissions match', async () => {
    hasPermission.mockResolvedValue(false);
    await expect(canAccessJobFormManagement(requestor)).resolves.toBe(false);
  });
});
