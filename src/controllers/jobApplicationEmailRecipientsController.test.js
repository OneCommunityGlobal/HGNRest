jest.mock('../models/userProfile');
jest.mock('../models/JobApplicationEmailRecipients');

const UserProfile = require('../models/userProfile');
const JobApplicationEmailRecipients = require('../models/JobApplicationEmailRecipients');
const { getRecipients, updateRecipients } = require('./jobApplicationEmailRecipientsController');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const requestFor = (userId, recipients) => ({
  user: userId ? { requestorId: userId } : undefined,
  body: recipients === undefined ? {} : { recipients },
});

describe('Job application email recipients', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();

    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'Administrator' }),
      }),
    });
  });

  test('Administrator can retrieve recipients', async () => {
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['admin@example.com'],
      }),
    });

    await getRecipients(requestFor('admin-id'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      recipients: ['admin@example.com'],
    });
  });

  test('Owner can retrieve recipients', async () => {
    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'Owner' }),
      }),
    });

    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await getRecipients(requestFor('owner-id'), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ recipients: [] });
  });

  test('Volunteer cannot retrieve recipients', async () => {
    UserProfile.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'Volunteer' }),
      }),
    });

    await getRecipients(requestFor('volunteer-id'), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(JobApplicationEmailRecipients.findOne).not.toHaveBeenCalled();
  });

  test('Unauthenticated user cannot update recipients', async () => {
    await updateRecipients(requestFor(null, ['test@example.com']), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(JobApplicationEmailRecipients.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('Invalid email addresses are rejected', async () => {
    await updateRecipients(requestFor('admin-id', ['invalid-email']), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JobApplicationEmailRecipients.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('Duplicate emails are normalized before saving', async () => {
    JobApplicationEmailRecipients.findOneAndUpdate.mockResolvedValue({
      recipients: ['admin@example.com'],
    });

    await updateRecipients(
      requestFor('admin-id', [' Admin@Example.com ', 'admin@example.com']),
      res,
    );

    expect(JobApplicationEmailRecipients.findOneAndUpdate).toHaveBeenCalledWith(
      { settingsKey: 'jobApplicationNotifications' },
      { $set: { recipients: ['admin@example.com'] } },
      { new: true, upsert: true, runValidators: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Database failures return 500', async () => {
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('Database unavailable')),
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await getRecipients(requestFor('admin-id'), res);
      expect(res.status).toHaveBeenCalledWith(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('rejects email recipients containing consecutive dots', async () => {
    await updateRecipients(requestFor('admin-id', ['richa@gmail..com']), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'One or more email addresses are invalid.',
    });
    expect(JobApplicationEmailRecipients.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
