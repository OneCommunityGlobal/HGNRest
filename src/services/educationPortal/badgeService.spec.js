jest.mock('../../models/educationPortal/badgeModel', () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.countDocuments = jest.fn();
  Model.findById = jest.fn();
  Model.findOne = jest.fn();
  Model.findByIdAndUpdate = jest.fn();
  return Model;
});
jest.mock('../../models/educationPortal/studentBadgesModel', () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.findOne = jest.fn();
  Model.countDocuments = jest.fn();
  Model.findByIdAndUpdate = jest.fn();
  Model.aggregate = jest.fn();
  return Model;
});

const Badge = require('../../models/educationPortal/badgeModel');
const StudentBadge = require('../../models/educationPortal/studentBadgesModel');
const BadgeService = require('./badgeService');

describe('BadgeService badge management', () => {
  const badgeId = '507f1f77bcf86cd799439011';
  const badgeData = {
    name: 'First Lesson',
    description: 'Completed the first lesson',
    image_url: 'https://example.test/badge.png',
    category: 'achievement',
    points: 10,
  };
  let query;
  let document;

  beforeEach(() => {
    jest.resetAllMocks();
    query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    document = {
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ _id: badgeId, ...badgeData }),
    };
    Badge.mockImplementation(() => document);
    Badge.find.mockReturnValue(query);
    Badge.countDocuments.mockResolvedValue(0);
    Badge.findOne.mockResolvedValue(null);
    Badge.findById.mockReturnValue(query);
    Badge.findByIdAndUpdate.mockResolvedValue(document);
  });

  describe('getAllBadges', () => {
    test('defaults to active badges and returns empty pagination', async () => {
      await expect(BadgeService.getAllBadges()).resolves.toEqual({
        badges: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      });
      expect(Badge.find).toHaveBeenCalledWith({ is_active: true });
      expect(Badge.countDocuments).toHaveBeenCalledWith({ is_active: true });
      expect(query.sort).toHaveBeenCalledWith({ ranking: 1, createdAt: -1 });
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(50);
    });

    test('filters inactive badges by category and counts the same selection', async () => {
      await BadgeService.getAllBadges({ category: 'milestone', isActive: false });
      const selection = { category: 'milestone', is_active: false };
      expect(Badge.find).toHaveBeenCalledWith(selection);
      expect(Badge.countDocuments).toHaveBeenCalledWith(selection);
    });

    test('returns records and rounds the last page up', async () => {
      const records = [{ _id: badgeId, ...badgeData }];
      query.lean.mockResolvedValue(records);
      Badge.countDocuments.mockResolvedValue(21);
      await expect(BadgeService.getAllBadges({ page: 3, limit: 10 })).resolves.toEqual({
        badges: records,
        pagination: { page: 3, limit: 10, total: 21, pages: 3 },
      });
      expect(query.skip).toHaveBeenCalledWith(20);
      expect(query.limit).toHaveBeenCalledWith(10);
    });

    test('does not add a category filter for an empty category', async () => {
      await BadgeService.getAllBadges({ category: '' });
      expect(Badge.find).toHaveBeenCalledWith({ is_active: true });
    });

    test('does not add an extra page for an exact page boundary', async () => {
      Badge.countDocuments.mockResolvedValue(20);
      const result = await BadgeService.getAllBadges({ limit: 10 });
      expect(result.pagination.pages).toBe(2);
    });

    test.each(['records', 'count'])('propagates a failed %s query', async (operation) => {
      const error = new Error('Database unavailable');
      if (operation === 'records') query.lean.mockRejectedValue(error);
      else Badge.countDocuments.mockRejectedValue(error);
      await expect(BadgeService.getAllBadges()).rejects.toBe(error);
    });
  });

  describe('getBadgeById', () => {
    test('returns a plain badge record', async () => {
      query.lean.mockResolvedValue(badgeData);
      await expect(BadgeService.getBadgeById(badgeId)).resolves.toEqual(badgeData);
      expect(Badge.findById).toHaveBeenCalledWith(badgeId);
      expect(query.lean).toHaveBeenCalledTimes(1);
    });
    test('returns null when no badge exists', async () => {
      query.lean.mockResolvedValue(null);
      await expect(BadgeService.getBadgeById(badgeId)).resolves.toBeNull();
    });
    test('propagates invalid ID or database errors', async () => {
      const error = new Error('Cast to ObjectId failed');
      query.lean.mockRejectedValue(error);
      await expect(BadgeService.getBadgeById('invalid-id')).rejects.toBe(error);
    });
  });

  describe('createBadge', () => {
    test('saves the supplied badge and returns its plain record', async () => {
      await expect(BadgeService.createBadge(badgeData)).resolves.toEqual({
        _id: badgeId,
        ...badgeData,
      });
      expect(Badge).toHaveBeenCalledWith(badgeData);
      expect(document.save).toHaveBeenCalledTimes(1);
      expect(document.toObject).toHaveBeenCalledTimes(1);
    });
    test('checks the whole name without case sensitivity', async () => {
      await BadgeService.createBadge(badgeData);
      const { $regex: namePattern } = Badge.findOne.mock.calls[0][0].name;
      expect(namePattern.test('first lesson')).toBe(true);
      expect(namePattern.test('First Lesson Advanced')).toBe(false);
      expect(namePattern.test('My First Lesson')).toBe(false);
    });
    test('rejects duplicate names without creating or saving a badge', async () => {
      Badge.findOne.mockResolvedValue({ _id: 'existing' });
      await expect(BadgeService.createBadge(badgeData)).rejects.toThrow(
        'A badge with this name already exists',
      );
      expect(Badge).not.toHaveBeenCalled();
      expect(document.save).not.toHaveBeenCalled();
    });
    test('propagates duplicate lookup failures without saving', async () => {
      const error = new Error('Lookup failed');
      Badge.findOne.mockRejectedValue(error);
      await expect(BadgeService.createBadge(badgeData)).rejects.toBe(error);
      expect(document.save).not.toHaveBeenCalled();
    });
    test('propagates save validation failures without returning a record', async () => {
      const error = new Error('Badge validation failed');
      document.save.mockRejectedValue(error);
      await expect(BadgeService.createBadge(badgeData)).rejects.toBe(error);
      expect(document.toObject).not.toHaveBeenCalled();
    });
  });

  describe('updateBadge', () => {
    test('updates fields with validation and returns the updated plain record', async () => {
      const update = { points: 25, description: 'An updated description' };
      document.toObject.mockReturnValue({ _id: badgeId, ...badgeData, ...update });
      await expect(BadgeService.updateBadge(badgeId, update)).resolves.toEqual({
        _id: badgeId,
        ...badgeData,
        ...update,
      });
      expect(Badge.findByIdAndUpdate).toHaveBeenCalledWith(
        badgeId,
        { $set: update },
        { new: true, runValidators: true },
      );
      expect(Badge.findOne).not.toHaveBeenCalled();
    });
    test('allows retaining a name by excluding the badge itself from duplicate lookup', async () => {
      await BadgeService.updateBadge(badgeId, { name: badgeData.name });
      const selection = Badge.findOne.mock.calls[0][0];
      expect(selection._id).toEqual({ $ne: badgeId });
      expect(selection.name.$regex.test('FIRST LESSON')).toBe(true);
      expect(selection.name.$regex.test('First Lesson Extended')).toBe(false);
    });
    test('rejects a duplicate rename without updating the badge', async () => {
      Badge.findOne.mockResolvedValue({ _id: 'other-badge' });
      await expect(BadgeService.updateBadge(badgeId, { name: 'Taken' })).rejects.toThrow(
        'A badge with this name already exists',
      );
      expect(Badge.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    test('rejects a missing badge', async () => {
      Badge.findByIdAndUpdate.mockResolvedValue(null);
      await expect(BadgeService.updateBadge(badgeId, { points: 25 })).rejects.toThrow(
        'Badge not found',
      );
    });
    test('propagates rename lookup errors without updating', async () => {
      const error = new Error('Lookup failed');
      Badge.findOne.mockRejectedValue(error);
      await expect(BadgeService.updateBadge(badgeId, { name: 'New Name' })).rejects.toBe(error);
      expect(Badge.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    test('propagates update validation errors', async () => {
      const error = new Error('Points cannot be negative');
      Badge.findByIdAndUpdate.mockRejectedValue(error);
      await expect(BadgeService.updateBadge(badgeId, { points: -1 })).rejects.toBe(error);
    });
  });

  describe('deleteBadge', () => {
    test('marks the badge inactive instead of deleting its document', async () => {
      const removed = { _id: badgeId, ...badgeData, is_active: false };
      Badge.findByIdAndUpdate.mockResolvedValue(removed);
      await expect(BadgeService.deleteBadge(badgeId)).resolves.toEqual(removed);
      expect(Badge.findByIdAndUpdate).toHaveBeenCalledWith(
        badgeId,
        { $set: { is_active: false } },
        { new: true },
      );
    });
    test('rejects a missing badge', async () => {
      Badge.findByIdAndUpdate.mockResolvedValue(null);
      await expect(BadgeService.deleteBadge(badgeId)).rejects.toThrow('Badge not found');
    });
    test('propagates database failures', async () => {
      const error = new Error('Write failed');
      Badge.findByIdAndUpdate.mockRejectedValue(error);
      await expect(BadgeService.deleteBadge(badgeId)).rejects.toBe(error);
    });
  });
});

describe('BadgeService student awards and reporting', () => {
  const studentId = '507f1f77bcf86cd799439012';
  const badgeId = '507f1f77bcf86cd799439011';
  const assignmentId = '507f1f77bcf86cd799439013';
  const awardedBy = '507f1f77bcf86cd799439014';
  let document;
  let query;

  beforeEach(() => {
    jest.resetAllMocks();
    document = {
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue({ _id: assignmentId, badge_id: badgeId }),
    };
    query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    StudentBadge.mockImplementation(() => document);
    StudentBadge.find.mockReturnValue(query);
    StudentBadge.findOne.mockResolvedValue(null);
    StudentBadge.countDocuments.mockResolvedValue(0);
    StudentBadge.aggregate.mockResolvedValue([]);
    StudentBadge.findByIdAndUpdate.mockResolvedValue({ _id: assignmentId, is_revoked: true });
    Badge.findOne.mockResolvedValue({ _id: badgeId, allow_multiple: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getStudentBadges', () => {
    test('lists only non-revoked awards with default pagination and public populated fields', async () => {
      await expect(BadgeService.getStudentBadges(studentId)).resolves.toEqual({
        badges: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      });
      const selection = { student_id: studentId, is_revoked: false };
      expect(StudentBadge.find).toHaveBeenCalledWith(selection);
      expect(StudentBadge.countDocuments).toHaveBeenCalledWith(selection);
      expect(query.populate).toHaveBeenNthCalledWith(
        1,
        'badge_id',
        'name description image_url category points',
      );
      expect(query.populate).toHaveBeenNthCalledWith(2, 'awarded_by', 'firstname lastname');
      expect(query.sort).toHaveBeenCalledWith({ awarded_at: -1 });
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(50);
    });
    test('filters by reason and paginates the same selection', async () => {
      const badges = [{ _id: assignmentId }];
      query.lean.mockResolvedValue(badges);
      StudentBadge.countDocuments.mockResolvedValue(11);
      await expect(
        BadgeService.getStudentBadges(studentId, { page: 2, limit: 5, reason: 'milestone' }),
      ).resolves.toEqual({
        badges,
        pagination: { page: 2, limit: 5, total: 11, pages: 3 },
      });
      expect(StudentBadge.countDocuments).toHaveBeenCalledWith({
        student_id: studentId,
        is_revoked: false,
        reason: 'milestone',
      });
      expect(StudentBadge.find).toHaveBeenCalledWith({
        student_id: studentId,
        is_revoked: false,
        reason: 'milestone',
      });
      expect(query.skip).toHaveBeenCalledWith(5);
      expect(query.limit).toHaveBeenCalledWith(5);
    });
    test.each(['records', 'count'])('propagates student %s query failures', async (operation) => {
      const error = new Error('Database unavailable');
      if (operation === 'records') query.lean.mockRejectedValue(error);
      else StudentBadge.countDocuments.mockRejectedValue(error);
      await expect(BadgeService.getStudentBadges(studentId)).rejects.toBe(error);
    });
  });

  describe('awardBadge', () => {
    test('saves an award with manual defaults and populates the returned record', async () => {
      await expect(BadgeService.awardBadge({ studentId, badgeId, awardedBy })).resolves.toEqual({
        _id: assignmentId,
        badge_id: badgeId,
      });
      expect(Badge.findOne).toHaveBeenCalledWith({ _id: badgeId, is_active: true });
      expect(StudentBadge.findOne).toHaveBeenCalledWith({
        student_id: studentId,
        badge_id: badgeId,
        is_revoked: false,
      });
      expect(StudentBadge).toHaveBeenCalledWith({
        student_id: studentId,
        badge_id: badgeId,
        reason: 'manual_award',
        awarded_by: awardedBy,
        metadata: {},
      });
      expect(document.save).toHaveBeenCalledTimes(1);
      expect(document.populate).toHaveBeenCalledWith([
        { path: 'badge_id', select: 'name description image_url category points' },
        { path: 'awarded_by', select: 'firstname lastname' },
      ]);
    });
    test('preserves an explicit reason and metadata', async () => {
      const metadata = { lessonId: 'lesson-1' };
      await BadgeService.awardBadge({
        studentId,
        badgeId,
        awardedBy,
        reason: 'milestone',
        metadata,
      });
      expect(StudentBadge).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'milestone', metadata }),
      );
    });
    test('rejects a missing or inactive badge without creating an award', async () => {
      Badge.findOne.mockResolvedValue(null);
      await expect(BadgeService.awardBadge({ studentId, badgeId })).rejects.toThrow(
        'Badge not found or inactive',
      );
      expect(StudentBadge).not.toHaveBeenCalled();
    });
    test('rejects an existing active award without saving', async () => {
      StudentBadge.findOne.mockResolvedValue({ _id: assignmentId });
      await expect(BadgeService.awardBadge({ studentId, badgeId })).rejects.toThrow(
        'Student already has this badge',
      );
      expect(document.save).not.toHaveBeenCalled();
    });
    test('skips the service duplicate check when multiple awards are enabled', async () => {
      Badge.findOne.mockResolvedValue({ _id: badgeId, allow_multiple: true });
      await BadgeService.awardBadge({ studentId, badgeId });
      expect(StudentBadge.findOne).not.toHaveBeenCalled();
      expect(document.save).toHaveBeenCalledTimes(1);
    });
    test.each(['badge lookup', 'duplicate lookup', 'save', 'populate'])(
      'propagates %s failures',
      async (operation) => {
        const error = new Error(`${operation} failed`);
        if (operation === 'badge lookup') Badge.findOne.mockRejectedValue(error);
        if (operation === 'duplicate lookup') StudentBadge.findOne.mockRejectedValue(error);
        if (operation === 'save') document.save.mockRejectedValue(error);
        if (operation === 'populate') document.populate.mockRejectedValue(error);
        await expect(BadgeService.awardBadge({ studentId, badgeId })).rejects.toBe(error);
        expect(document.toObject).not.toHaveBeenCalled();
      },
    );
  });

  describe('revokeBadge', () => {
    test.each([null, 'Awarded in error'])(
      'records revocation time and reason %s',
      async (reason) => {
        const before = Date.now();
        const result =
          reason === null
            ? await BadgeService.revokeBadge(assignmentId)
            : await BadgeService.revokeBadge(assignmentId, reason);
        const [id, update, options] = StudentBadge.findByIdAndUpdate.mock.calls[0];
        expect(id).toBe(assignmentId);
        expect(update.$set).toEqual({
          is_revoked: true,
          revoked_at: expect.any(Date),
          revoke_reason: reason,
        });
        expect(update.$set.revoked_at.getTime()).toBeGreaterThanOrEqual(before);
        expect(update.$set.revoked_at.getTime()).toBeLessThanOrEqual(Date.now());
        expect(options).toEqual({ new: true });
        expect(result).toEqual({ _id: assignmentId, is_revoked: true });
      },
    );
    test('rejects an unknown assignment', async () => {
      StudentBadge.findByIdAndUpdate.mockResolvedValue(null);
      await expect(BadgeService.revokeBadge(assignmentId)).rejects.toThrow(
        'Badge assignment not found',
      );
    });
    test('propagates revocation write failures', async () => {
      const error = new Error('Write failed');
      StudentBadge.findByIdAndUpdate.mockRejectedValue(error);
      await expect(BadgeService.revokeBadge(assignmentId)).rejects.toBe(error);
    });
  });

  describe('getStudentBadgeStats', () => {
    test('returns zero totals for a student without awards', async () => {
      await expect(BadgeService.getStudentBadgeStats(studentId)).resolves.toEqual({
        totalBadges: 0,
        totalPoints: 0,
        byCategory: [],
      });
    });
    test('totals category points and excludes revoked assignments', async () => {
      const stats = [
        { _id: 'achievement', count: 2, totalPoints: 30 },
        { _id: 'milestone', count: 1, totalPoints: 5 },
        { _id: 'capstone', count: 1 },
      ];
      StudentBadge.aggregate.mockResolvedValue(stats);
      StudentBadge.countDocuments.mockResolvedValue(4);
      await expect(BadgeService.getStudentBadgeStats(studentId)).resolves.toEqual({
        totalBadges: 4,
        totalPoints: 35,
        byCategory: stats,
      });
      expect(StudentBadge.countDocuments).toHaveBeenCalledWith({
        student_id: studentId,
        is_revoked: false,
      });
      const pipeline = StudentBadge.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: { student_id: studentId, is_revoked: false } });
      expect(pipeline).toContainEqual({
        $lookup: { from: 'epbadges', localField: 'badge_id', foreignField: '_id', as: 'badge' },
      });
      expect(pipeline).toContainEqual({
        $group: {
          _id: '$badge.category',
          count: { $sum: 1 },
          totalPoints: { $sum: '$badge.points' },
        },
      });
    });
    test.each(['aggregate', 'countDocuments'])(
      'propagates statistics %s failures',
      async (operation) => {
        const error = new Error('Statistics failed');
        StudentBadge[operation].mockRejectedValue(error);
        await expect(BadgeService.getStudentBadgeStats(studentId)).rejects.toBe(error);
      },
    );
  });

  describe('bulkAwardBadges', () => {
    test('returns empty result groups for an empty batch', async () => {
      await expect(BadgeService.bulkAwardBadges([])).resolves.toEqual({
        successful: [],
        failed: [],
      });
      expect(document.save).not.toHaveBeenCalled();
    });
    test('retains successful awards when another award fails', async () => {
      const good = { studentId, badgeId };
      const bad = { studentId, badgeId: 'missing' };
      Badge.findOne.mockImplementation(async ({ _id: id }) =>
        id === badgeId ? { _id: badgeId, allow_multiple: false } : null,
      );
      await expect(BadgeService.bulkAwardBadges([good, bad])).resolves.toEqual({
        successful: [{ ...good, badge: { _id: assignmentId, badge_id: badgeId } }],
        failed: [{ ...bad, error: 'Badge not found or inactive' }],
      });
      expect(document.save).toHaveBeenCalledTimes(1);
    });
    test('reports every failure in an unsuccessful batch', async () => {
      Badge.findOne.mockResolvedValue(null);
      const awards = [
        { studentId, badgeId },
        { studentId: 'another', badgeId },
      ];
      const result = await BadgeService.bulkAwardBadges(awards);
      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual(
        awards.map((award) => ({ ...award, error: 'Badge not found or inactive' })),
      );
    });
  });

  describe('getBadgeLeaderboard', () => {
    test('uses active awards, point/count ranking, a default limit and public student fields', async () => {
      const leaders = [{ student_id: studentId, totalPoints: 50, badgeCount: 2 }];
      StudentBadge.aggregate.mockResolvedValue(leaders);
      await expect(BadgeService.getBadgeLeaderboard()).resolves.toEqual(leaders);
      const pipeline = StudentBadge.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: { is_revoked: false } });
      expect(pipeline).toContainEqual({ $sort: { totalPoints: -1, badgeCount: -1 } });
      expect(pipeline).toContainEqual({ $limit: 10 });
      expect(pipeline).toContainEqual({
        $project: {
          student_id: '$_id',
          badgeCount: 1,
          totalPoints: 1,
          'student.firstname': 1,
          'student.lastname': 1,
        },
      });
      expect(pipeline.filter((stage) => stage.$match)).toHaveLength(1);
    });
    test('filters by category before grouping and accepts a custom limit', async () => {
      await BadgeService.getBadgeLeaderboard({ category: 'capstone', limit: 3 });
      const pipeline = StudentBadge.aggregate.mock.calls[0][0];
      const matchIndex = pipeline.findIndex(
        (stage) => stage.$match && stage.$match['badge.category'],
      );
      expect(pipeline[matchIndex]).toEqual({ $match: { 'badge.category': 'capstone' } });
      expect(matchIndex).toBeLessThan(pipeline.findIndex((stage) => stage.$group));
      expect(pipeline).toContainEqual({ $limit: 3 });
    });
    test('propagates leaderboard failures', async () => {
      const error = new Error('Leaderboard failed');
      StudentBadge.aggregate.mockRejectedValue(error);
      await expect(BadgeService.getBadgeLeaderboard()).rejects.toBe(error);
    });
  });

  describe('awardBadgeOnCompletion', () => {
    test.each([
      ['capstone', 'capstone_completion'],
      ['lesson_completion', 'lesson_completion'],
    ])('awards %s using the appropriate reason', async (completionType, reason) => {
      const metadata = { taskId: 'task-1' };
      await expect(
        BadgeService.awardBadgeOnCompletion(studentId, completionType, metadata),
      ).resolves.toEqual({ _id: assignmentId, badge_id: badgeId });
      expect(Badge.findOne).toHaveBeenNthCalledWith(1, {
        category: completionType,
        is_active: true,
      });
      expect(StudentBadge).toHaveBeenCalledWith({
        student_id: studentId,
        badge_id: badgeId,
        awarded_by: null,
        reason,
        metadata,
      });
    });
    test('returns null and warns when no completion badge exists', async () => {
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
      Badge.findOne.mockResolvedValue(null);
      await expect(
        BadgeService.awardBadgeOnCompletion(studentId, 'capstone', {}),
      ).resolves.toBeNull();
      expect(warning).toHaveBeenCalledWith('No badge found for completion type: capstone');
      expect(document.save).not.toHaveBeenCalled();
    });
    test.each(['lookup', 'save'])(
      'returns null and logs an automatic-award %s failure',
      async (operation) => {
        const error = new Error('Automatic award failed');
        const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
        if (operation === 'lookup') Badge.findOne.mockRejectedValue(error);
        else document.save.mockRejectedValue(error);
        await expect(
          BadgeService.awardBadgeOnCompletion(studentId, 'capstone', {}),
        ).resolves.toBeNull();
        expect(logger).toHaveBeenCalledWith('Error awarding badge on completion:', error);
      },
    );
  });
});
