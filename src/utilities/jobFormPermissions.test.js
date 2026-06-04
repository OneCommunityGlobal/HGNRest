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

  it('canCreateFormQuestions allows manageJobForms or createFormQuestions', async () => {
    hasPermission.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(canCreateFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenNthCalledWith(1, requestor, 'manageJobForms');
    expect(hasPermission).toHaveBeenNthCalledWith(2, requestor, 'createFormQuestions');
  });

  it('canEditFormQuestions allows manageJobForms or editFormQuestions', async () => {
    hasPermission.mockResolvedValueOnce(true);
    await expect(canEditFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'manageJobForms');
  });

  it('canDeleteFormQuestions allows manageJobForms or deleteFormQuestions', async () => {
    hasPermission.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(canDeleteFormQuestions(requestor)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenNthCalledWith(2, requestor, 'deleteFormQuestions');
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
