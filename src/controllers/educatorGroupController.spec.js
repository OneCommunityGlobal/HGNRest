const mongoose = require('mongoose');
const { mockReq, mockRes } = require('../test');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');
const ctrl = require('./educatorGroupController');

const EDUCATOR_ID = '65cf6c3706d8ac105827bb2e';
const GROUP_ID = '507f1f77bcf86cd799439011';
const STUDENT_ID_1 = '507f1f77bcf86cd799439012';
const STUDENT_ID_2 = '507f1f77bcf86cd799439013';

const makeGroup = (overrides = {}) => ({
  _id: GROUP_ID,
  educator_id: EDUCATOR_ID,
  name: 'Test Group',
  description: 'A test group',
  ...overrides,
});

const makeMember = (studentId, groupId = GROUP_ID) => ({
  _id: new mongoose.Types.ObjectId(),
  group_id: groupId,
  student_id: studentId,
});

beforeEach(() => {
  mockReq.body = {
    requestor: { requestorId: EDUCATOR_ID, role: 'Administrator' },
  };
  mockReq.params = {};
  jest.clearAllMocks();
});

describe('getAllStudents', () => {
  test('Returns 200 with students list', async () => {
    const students = [
      { _id: STUDENT_ID_1, firstName: 'Alice', lastName: 'Smith' },
      { _id: STUDENT_ID_2, firstName: 'Bob', lastName: 'Jones' },
    ];
    jest.spyOn(UserProfile, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(students),
      }),
    });

    await ctrl.getAllStudents(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(students);
  });

  test('Returns 500 on error', async () => {
    jest.spyOn(UserProfile, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('DB error')),
      }),
    });

    await ctrl.getAllStudents(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'DB error' });
  });
});

describe('createGroup', () => {
  beforeEach(() => {
    mockReq.body.name = 'New Group';
    mockReq.body.description = 'Description';
    mockReq.body.studentIds = [STUDENT_ID_1, STUDENT_ID_2];
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 403 if role is not elevated', async () => {
    mockReq.body.requestor.role = 'Volunteer';
    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  test('Returns 201 if role is Educator', async () => {
    mockReq.body.requestor.role = 'Educator';
    const group = makeGroup();
    jest.spyOn(StudentGroup, 'create').mockResolvedValue(group);
    jest.spyOn(StudentGroupMember, 'insertMany').mockResolvedValue([]);

    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  test('Returns 201 if role is Manager', async () => {
    mockReq.body.requestor.role = 'Manager';
    const group = makeGroup();
    jest.spyOn(StudentGroup, 'create').mockResolvedValue(group);
    jest.spyOn(StudentGroupMember, 'insertMany').mockResolvedValue([]);

    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  test('Returns 400 if name is missing', async () => {
    delete mockReq.body.name;
    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Group name is required' });
  });

  test('Returns 201 and creates group with members', async () => {
    const group = makeGroup();
    jest.spyOn(StudentGroup, 'create').mockResolvedValue(group);
    jest.spyOn(StudentGroupMember, 'insertMany').mockResolvedValue([]);

    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(group);
    expect(StudentGroupMember.insertMany).toHaveBeenCalled();
  });

  test('Returns 201 without insertMany when studentIds is empty', async () => {
    mockReq.body.studentIds = [];
    const group = makeGroup();
    jest.spyOn(StudentGroup, 'create').mockResolvedValue(group);

    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(StudentGroupMember.insertMany).not.toHaveBeenCalled();
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'create').mockRejectedValue(new Error('Create failed'));
    await ctrl.createGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Create failed' });
  });
});

describe('getGroups', () => {
  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.getGroups(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 200 with groups', async () => {
    const groups = [makeGroup(), makeGroup({ _id: '507f1f77bcf86cd799439014', name: 'Group 2' })];
    jest.spyOn(StudentGroup, 'find').mockReturnValue({
      sort: jest.fn().mockResolvedValue(groups),
    });

    await ctrl.getGroups(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(groups);
  });

  test('Returns 500 on error', async () => {
    jest.spyOn(StudentGroup, 'find').mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error('DB error')),
    });

    await ctrl.getGroups(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'DB error' });
  });
});

describe('getGroupMembers', () => {
  beforeEach(() => {
    mockReq.params.groupId = GROUP_ID;
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.getGroupMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 403 if group not found or not owned by educator', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(null);
    await ctrl.getGroupMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized access to group' });
  });

  test('Returns 200 with members', async () => {
    const members = [makeMember(STUDENT_ID_1), makeMember(STUDENT_ID_2)];
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroupMember, 'find').mockReturnValue({
      populate: jest.fn().mockResolvedValue(members),
    });

    await ctrl.getGroupMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(members);
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockRejectedValue(new Error('DB error'));
    await ctrl.getGroupMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

describe('addMembers', () => {
  beforeEach(() => {
    mockReq.params.groupId = GROUP_ID;
    mockReq.body.studentIds = [STUDENT_ID_1, STUDENT_ID_2];
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 400 if studentIds is empty', async () => {
    mockReq.body.studentIds = [];
    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No students provided' });
  });

  test('Returns 403 if group not found', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(null);
    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  test('Returns 400 if no valid student IDs', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    mockReq.body.studentIds = ['invalid-id'];
    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No valid student IDs provided' });
  });

  test('Returns 400 if all students already in group', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroupMember, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue([makeMember(STUDENT_ID_1), makeMember(STUDENT_ID_2)]),
    });

    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'All students are already in the group' });
  });

  test('Returns 201 and adds new members', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroupMember, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(StudentGroupMember, 'insertMany').mockResolvedValue([]);

    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ added: 2 });
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockRejectedValue(new Error('DB error'));
    await ctrl.addMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

describe('removeMembers', () => {
  beforeEach(() => {
    mockReq.params.groupId = GROUP_ID;
    mockReq.body.studentIds = [STUDENT_ID_1];
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.removeMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 400 if studentIds is empty', async () => {
    mockReq.body.studentIds = [];
    await ctrl.removeMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No students provided for removal' });
  });

  test('Returns 403 if group not found', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(null);
    await ctrl.removeMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  test('Returns 200 with removed count', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroupMember, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

    await ctrl.removeMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ removed: 1 });
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockRejectedValue(new Error('DB error'));
    await ctrl.removeMembers(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

describe('updateGroup', () => {
  beforeEach(() => {
    mockReq.params.groupId = GROUP_ID;
    mockReq.body.name = 'Updated Group';
    mockReq.body.description = 'Updated description';
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.updateGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 404 if group not found', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(null);
    await ctrl.updateGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  test('Returns 403 if educator_id does not match', async () => {
    jest
      .spyOn(StudentGroup, 'findOne')
      .mockResolvedValue(makeGroup({ educator_id: '507f1f77bcf86cd799439099' }));
    await ctrl.updateGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized access to group' });
  });

  test('Returns 200 with updated group', async () => {
    const updated = makeGroup({ name: 'Updated Group', description: 'Updated description' });
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroup, 'findOneAndUpdate').mockResolvedValue(updated);

    await ctrl.updateGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(updated);
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockRejectedValue(new Error('DB error'));
    await ctrl.updateGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteGroup', () => {
  beforeEach(() => {
    mockReq.params.groupId = GROUP_ID;
  });

  test('Returns 401 if no requestor', async () => {
    mockReq.body.requestor = {};
    await ctrl.deleteGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('Returns 404 if group not found', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(null);
    await ctrl.deleteGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  test('Returns 403 if educator_id does not match', async () => {
    jest
      .spyOn(StudentGroup, 'findOne')
      .mockResolvedValue(makeGroup({ educator_id: '507f1f77bcf86cd799439099' }));
    await ctrl.deleteGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized access to group' });
  });

  test('Returns 204 and deletes group with members', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockResolvedValue(makeGroup());
    jest.spyOn(StudentGroupMember, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
    jest.spyOn(StudentGroup, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    await ctrl.deleteGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(204);
    expect(mockRes.send).toHaveBeenCalled();
    expect(StudentGroupMember.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: expect.any(mongoose.Types.ObjectId) }),
    );
    expect(StudentGroup.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(mongoose.Types.ObjectId) }),
    );
  });

  test('Returns 400 on error', async () => {
    jest.spyOn(StudentGroup, 'findOne').mockRejectedValue(new Error('DB error'));
    await ctrl.deleteGroup(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
