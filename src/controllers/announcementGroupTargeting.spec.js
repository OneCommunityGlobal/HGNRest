const mongoose = require('mongoose');
const Announcement = require('../models/announcements');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');
const controller = require('./announcementController')();

// Fake, valid MongoDB ObjectIds used only as fixtures: author, group, two users, and announcement.
const AUTHOR = '507f1f77bcf86cd799439011';
const GROUP = '507f1f77bcf86cd799439012';
const STUDENT = '507f1f77bcf86cd799439013';
const OTHER = '507f1f77bcf86cd799439014';
const ID = '507f1f77bcf86cd799439015';
let req;
let res;
let save;

// Reset authenticated requests and mock database operations; no live database is used.
// Default membership includes duplicates/invalid entries, with only STUDENT resolving as a student.
beforeEach(() => {
  req = {
    body: {
      title: 'Title',
      body: 'Body',
      audience: 'students',
      requestor: { requestorId: AUTHOR, role: 'Owner' },
    },
    params: { announcementId: ID },
    query: {},
  };
  res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  save = jest.spyOn(Announcement.prototype, 'save').mockImplementation(async function () {
    return this;
  });
  jest.spyOn(Announcement.prototype, 'populate').mockReturnThis();
  jest.spyOn(Announcement.prototype, 'execPopulate').mockImplementation(async function () {
    this.creatorInfo = { firstName: 'Ada', lastName: 'Lovelace' };
    return this;
  });
  jest.spyOn(Announcement, 'findOne').mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
  jest.spyOn(StudentGroup, 'findOne').mockResolvedValue({ _id: GROUP });
  jest
    .spyOn(StudentGroupMember, 'find')
    .mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          { student_id: STUDENT },
          { student_id: STUDENT },
          { student_id: OTHER },
          { student_id: null },
        ]),
    });
  jest
    .spyOn(UserProfile, 'find')
    .mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: STUDENT }]) });
});
afterEach(() => jest.restoreAllMocks());

function saved() {
  return res.send.mock.calls[0][0].data;
}
function existing() {
  const doc = new Announcement({
    _id: ID,
    announcement_id: 1,
    user_id: AUTHOR,
    title: 'Old',
    body: 'Old body',
    audience: 'students',
    groupId: GROUP,
    recipientStudentIds: [STUDENT],
  });
  Announcement.findOne.mockResolvedValue(doc);
  return doc;
}

// Creation authorization and server-resolved recipient snapshots.
test.each(['Administrator', 'Owner', 'Teacher', 'Program Manager'])(
  'preserves broad create authorization for %s',
  async (role) => {
    req.body.requestor.role = role;
    await controller.createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(saved().recipientStudentIds).toBeUndefined();
    expect(StudentGroup.findOne).not.toHaveBeenCalled();
  },
);
test.each(['student', 'Educator', 'Mentor'])(
  'rejects unauthorized create/update role %s',
  async (role) => {
    req.body.requestor.role = role;
    await controller.createAnnouncement(req, res);
    await controller.updateAnnouncement(req, res);
    expect(res.status.mock.calls).toEqual([[403], [403]]);
    expect(save).not.toHaveBeenCalled();
  },
);
test('resolves owned group and stores distinct existing student IDs only', async () => {
  req.body.groupId = GROUP;
  await controller.createAnnouncement(req, res);
  expect(StudentGroup.findOne).toHaveBeenCalledWith({ _id: GROUP, educator_id: AUTHOR });
  expect(StudentGroupMember.find).toHaveBeenCalledWith({ group_id: GROUP });
  expect(UserProfile.find).toHaveBeenCalledWith({
    _id: { $in: [STUDENT, OTHER] },
    role: 'student',
  });
  expect(saved().recipientStudentIds.map(String)).toEqual([STUDENT]);
  expect(String(saved().groupId)).toBe(GROUP);
});
test.each(['bad-id', '', null])('rejects invalid group %s', async (groupId) => {
  req.body.groupId = groupId;
  await controller.createAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(save).not.toHaveBeenCalled();
});
test('missing or other-author group is rejected', async () => {
  req.body.groupId = GROUP;
  StudentGroup.findOne.mockResolvedValue(null);
  await controller.createAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(save).not.toHaveBeenCalled();
});
test('empty or no-valid-student group is rejected', async () => {
  req.body.groupId = GROUP;
  StudentGroupMember.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  UserProfile.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  await controller.createAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(save).not.toHaveBeenCalled();
});
test('caller-supplied recipients and incompatible audiences are rejected', async () => {
  req.body.recipientStudentIds = [OTHER];
  await controller.createAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  delete req.body.recipientStudentIds;
  req.body.groupId = GROUP;
  req.body.audience = 'educators';
  await controller.createAnnouncement(req, res);
  expect(save).not.toHaveBeenCalled();
});
// Author-only edits preserve or explicitly replace/remove the saved targeting snapshot.
test('author edit preserves snapshot when group is omitted', async () => {
  const doc = existing();
  await controller.updateAnnouncement(req, res);
  expect(Announcement.findOne).toHaveBeenCalledWith({ _id: ID, user_id: AUTHOR });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(doc.title).toBe('Title');
  expect(doc.recipientStudentIds.map(String)).toEqual([STUDENT]);
  expect(StudentGroup.findOne).not.toHaveBeenCalled();
});
test('non-author cannot update', async () => {
  Announcement.findOne.mockResolvedValue(null);
  await controller.updateAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(save).not.toHaveBeenCalled();
});
test('explicit group change refreshes snapshot only from owned group', async () => {
  const doc = existing();
  req.body.groupId = GROUP;
  await controller.updateAnnouncement(req, res);
  expect(StudentGroup.findOne).toHaveBeenCalledWith({ _id: GROUP, educator_id: AUTHOR });
  expect(doc.recipientStudentIds.map(String)).toEqual([STUDENT]);
});
test.each([null, 'empty'])(
  'update rejects missing/foreign or empty target group: %s',
  async (result) => {
    existing();
    req.body.groupId = GROUP;
    if (result === null) StudentGroup.findOne.mockResolvedValue(null);
    else UserProfile.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await controller.updateAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(result === null ? 404 : 400);
    expect(save).not.toHaveBeenCalled();
  },
);
test.each(['students', 'support', 'educators', 'all'])(
  'broad %s announcements still save without targeting',
  async (audience) => {
    req.body.audience = audience;
    await controller.createAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(saved().audience).toBe(audience);
    expect(saved().recipientStudentIds).toBeUndefined();
    expect(saved().groupId).toBeUndefined();
  },
);
test('explicit null group restores broad targeting', async () => {
  const doc = existing();
  req.body.groupId = null;
  req.body.audience = 'support';
  await controller.updateAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(doc.recipientStudentIds).toBeUndefined();
  expect(doc.groupId).toBeUndefined();
});
test('changing audience alone cannot leak a targeted announcement', async () => {
  existing();
  req.body.audience = 'support';
  await controller.updateAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(save).not.toHaveBeenCalled();
});
test('update rejects supplied recipients and invalid announcement IDs', async () => {
  existing();
  req.body.recipientStudentIds = [OTHER];
  await controller.updateAnnouncement(req, res);
  req.params.announcementId = 'invalid';
  await controller.updateAnnouncement(req, res);
  expect(res.status.mock.calls).toEqual([[400], [400]]);
  expect(save).not.toHaveBeenCalled();
});

// Read queries use authenticated identity and share their visibility filter with pagination counts.
test('author can explicitly change a targeted announcement to Everyone', async () => {
  const doc = existing();
  req.body.audience = 'all';
  req.body.groupId = null;
  await controller.updateAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(doc.audience).toBe('all');
  expect(doc.groupId).toBeUndefined();
  expect(doc.recipientStudentIds).toBeUndefined();
  expect(doc.validateSync()).toBeUndefined();
});
test('Everyone cannot be combined with group targeting or an existing snapshot', async () => {
  req.body.audience = 'all';
  req.body.groupId = GROUP;
  await controller.createAnnouncement(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  existing();
  delete req.body.groupId;
  await controller.updateAnnouncement(req, res);
  expect(save).not.toHaveBeenCalled();
  expect(res.status.mock.calls).toEqual([[400], [400]]);
});
test.each(['student', 'Teacher', 'Mentor', 'Owner'])(
  'Everyone is included in authenticated %s reads',
  async (role) => {
    req.body.requestor.role = role;
    const query = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(Announcement, 'find').mockReturnValue(query);
    jest.spyOn(Announcement, 'countDocuments').mockResolvedValue(0);
    await controller.getStudentAnnouncements(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const filter = Announcement.find.mock.calls[0][0];
    expect(filter.$or[0]).toEqual({
      audience: { $in: ['students', 'support', 'all'] },
      recipientStudentIds: { $exists: false },
      groupId: { $exists: false },
    });
    expect(Announcement.countDocuments).toHaveBeenCalledWith(filter);
  },
);
test.each([STUDENT, OTHER])(
  'student visibility and pagination use authenticated identity %s',
  async (userId) => {
    req.body.requestor.requestorId = userId;
    req.query = { page: '2', limit: '3', studentId: STUDENT };
    const query = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(Announcement, 'find').mockReturnValue(query);
    jest.spyOn(Announcement, 'countDocuments').mockResolvedValue(7);
    await controller.getStudentAnnouncements(req, res);
    const filter = Announcement.find.mock.calls[0][0];
    expect(filter).toEqual({
      $or: [
        {
          audience: { $in: ['students', 'support', 'all'] },
          recipientStudentIds: { $exists: false },
          groupId: { $exists: false },
        },
        { audience: 'students', recipientStudentIds: mongoose.Types.ObjectId(userId) },
      ],
    });
    expect(Announcement.countDocuments).toHaveBeenCalledWith(filter);
    expect(query.select).toHaveBeenCalledWith('-recipientStudentIds');
    expect(query.skip).toHaveBeenCalledWith(3);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(res.send.mock.calls[0][0].pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 7,
      itemsPerPage: 3,
    });
  },
);
test('missing authentication cannot access student announcements', async () => {
  delete req.body.requestor;
  await controller.getStudentAnnouncements(req, res);
  expect(res.status).toHaveBeenCalledWith(401);
});
// Schema compatibility and update-route wiring.
test('model leaves legacy recipients absent and preserves explicit empty snapshots', () => {
  const doc = new Announcement({
    announcement_id: 1,
    user_id: AUTHOR,
    title: 'Title',
    body: 'Body',
  });
  expect(doc.validateSync()).toBeUndefined();
  expect(doc.recipientStudentIds).toBeUndefined();
  doc.recipientStudentIds = [];
  expect(doc.toObject().recipientStudentIds).toEqual([]);
});
test('PUT route exposes author-authorized update handler', () => {
  const router = require('../routes/announcementRouter')();
  const { route } = router.stack.find(
    (layer) => layer.route?.path === '/educator/announcements/:announcementId',
  );
  expect(route.methods.put).toBe(true);
  expect(route.stack[0].handle.name).toBe('updateAnnouncement');
});

test('create and update execute document population before returning the author', async () => {
  req.body.groupId = GROUP;
  await controller.createAnnouncement(req, res);
  expect(saved().creatorInfo.firstName).toBe('Ada');
  expect(String(saved().groupId)).toBe(GROUP);
  const doc = existing();
  await controller.updateAnnouncement(req, res);
  expect(doc.creatorInfo.lastName).toBe('Lovelace');
  expect(Announcement.prototype.execPopulate).toHaveBeenCalledTimes(2);
});
