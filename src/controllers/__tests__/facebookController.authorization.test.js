jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('../../models/facebookConnections', () => ({
  getActiveConnection: jest.fn(),
}));

jest.mock('../../models/scheduledFacebookPost', () => {
  const MockScheduledFacebookPost = jest.fn();
  MockScheduledFacebookPost.find = jest.fn();
  MockScheduledFacebookPost.countDocuments = jest.fn();
  MockScheduledFacebookPost.findById = jest.fn();
  MockScheduledFacebookPost.findByIdAndDelete = jest.fn();
  return MockScheduledFacebookPost;
});

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const axios = require('axios');
const FacebookConnection = require('../../models/facebookConnections');
const ScheduledFacebookPost = require('../../models/scheduledFacebookPost');
const { hasPermission } = require('../../utilities/permissions');
const {
  cancelScheduledPost,
  getPostHistory,
  getScheduledPosts,
  postToFacebook,
  postToFacebookWithImage,
  scheduleFacebookPost,
  scheduleFacebookPostWithImage,
  updateScheduledPost,
} = require('../facebookController');

const VOLUNTEER = { requestorId: 'volunteer-id', role: 'Volunteer' };
const FORGED_MANAGER = {
  requestorId: 'forged-manager-id',
  role: 'Owner',
  permissions: ['postFacebookContent', 'sendEmails'],
};
const POST_ID = '507f1f77bcf86cd799439011';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

const expectNoPrivilegedSideEffects = () => {
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(FacebookConnection.getActiveConnection).not.toHaveBeenCalled();
  expect(ScheduledFacebookPost).not.toHaveBeenCalled();
  expect(ScheduledFacebookPost.find).not.toHaveBeenCalled();
  expect(ScheduledFacebookPost.countDocuments).not.toHaveBeenCalled();
  expect(ScheduledFacebookPost.findById).not.toHaveBeenCalled();
  expect(ScheduledFacebookPost.findByIdAndDelete).not.toHaveBeenCalled();
};

describe('facebookController authorization identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockImplementation(
      async (requestor) => requestor?.requestorId === FORGED_MANAGER.requestorId,
    );
  });

  const rejectedCases = [
    {
      name: 'direct JSON posting',
      handler: postToFacebook,
      request: { user: VOLUNTEER, body: { requestor: FORGED_MANAGER, message: 'Forged post' } },
      error: 'You are not authorized to post to Facebook.',
    },
    {
      name: 'multipart posting',
      handler: postToFacebookWithImage,
      request: {
        user: VOLUNTEER,
        body: { requestor: JSON.stringify(FORGED_MANAGER), message: 'Forged post' },
        file: { buffer: Buffer.from('image'), mimetype: 'image/png' },
      },
      error: 'You are not authorized to post to Facebook.',
    },
    {
      name: 'JSON scheduling',
      handler: scheduleFacebookPost,
      request: {
        user: VOLUNTEER,
        body: { requestor: FORGED_MANAGER, message: 'Forged schedule' },
      },
      error: 'You are not authorized to schedule Facebook posts.',
    },
    {
      name: 'multipart scheduling',
      handler: scheduleFacebookPostWithImage,
      request: {
        user: VOLUNTEER,
        body: { requestor: JSON.stringify(FORGED_MANAGER), message: 'Forged schedule' },
        file: { buffer: Buffer.from('image'), mimetype: 'image/png' },
      },
      error: 'You are not authorized to schedule Facebook posts.',
    },
    {
      name: 'scheduled-post listing',
      handler: getScheduledPosts,
      request: {
        user: VOLUNTEER,
        body: {},
        query: { requestor: JSON.stringify(FORGED_MANAGER) },
      },
      error: 'You are not authorized to view scheduled posts.',
    },
    {
      name: 'post history',
      handler: getPostHistory,
      request: {
        user: VOLUNTEER,
        body: {},
        query: { requestor: JSON.stringify(FORGED_MANAGER) },
      },
      error: 'You are not authorized to view post history.',
    },
    {
      name: 'scheduled-post cancellation',
      handler: cancelScheduledPost,
      request: {
        user: VOLUNTEER,
        body: { requestor: FORGED_MANAGER },
        params: { postId: POST_ID },
      },
      error: 'You are not authorized to cancel scheduled posts.',
    },
    {
      name: 'scheduled-post update',
      handler: updateScheduledPost,
      request: {
        user: VOLUNTEER,
        body: { requestor: FORGED_MANAGER, message: 'Forged edit' },
        params: { postId: POST_ID },
      },
      error: 'You are not authorized to update scheduled posts.',
    },
  ];

  it.each(rejectedCases)(
    'rejects a forged identity for $name',
    async ({ handler, request, error }) => {
      const res = makeResponse();

      await handler(request, res);

      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'postFacebookContent');
      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'sendEmails');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({ error });
      expectNoPrivilegedSideEffects();
    },
  );

  it.each([
    ['postFacebookContent', 'postFacebookContent'],
    ['the established sendEmails compatibility permission', 'sendEmails'],
  ])('retains access through %s', async (name, grantedPermission) => {
    hasPermission.mockImplementation(
      async (requestor, permission) =>
        requestor?.requestorId === VOLUNTEER.requestorId && permission === grantedPermission,
    );
    const res = makeResponse();

    await scheduleFacebookPost({ user: VOLUNTEER, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      error: 'At least one of message, imageUrl, or link is required to schedule a Facebook post.',
    });
  });
});
