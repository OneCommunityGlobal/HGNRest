const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');
const Badge = require('../../models/educationPortal/badgeModel');
const StudentBadge = require('../../models/educationPortal/studentBadgesModel');
const BadgeService = require('../../services/educationPortal/badgeService');

// Minimal user model keeps this suite independent of production account services.
const User =
  mongoose.models.userProfile ||
  mongoose.model(
    'userProfile',
    new mongoose.Schema({ firstname: String, lastname: String }),
    'users',
  );

let server;
let student;
let teacher;
const badgeData = (overrides = {}) => ({
  name: 'First Lesson',
  description: 'Completed the first lesson successfully',
  image_url: 'https://example.test/badge.png',
  points: 10,
  ...overrides,
});

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri('badge_service_tests'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await Promise.all([Badge.init(), StudentBadge.init(), User.init()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (server) await server.stop();
});

beforeEach(async () => {
  await Promise.all([Badge.deleteMany({}), StudentBadge.deleteMany({}), User.deleteMany({})]);
  student = await User.create({ firstname: 'Test', lastname: 'Student' });
  teacher = await User.create({ firstname: 'Test', lastname: 'Teacher' });
});

describe('BadgeService with an isolated MongoDB database', () => {
  test('persists creation and updates, and soft deletion preserves the document', async () => {
    const badge = await BadgeService.createBadge(badgeData());
    expect((await Badge.findById(badge._id).lean()).points).toBe(10);
    await BadgeService.updateBadge(badge._id, { points: 25 });
    expect((await BadgeService.getBadgeById(badge._id)).points).toBe(25);
    await BadgeService.deleteBadge(badge._id);
    expect((await Badge.findById(badge._id).lean()).is_active).toBe(false);
    expect((await BadgeService.getAllBadges()).badges).toHaveLength(0);
    expect((await BadgeService.getAllBadges({ isActive: false })).badges).toHaveLength(1);
  });

  test('orders and paginates filtered badges using the real query', async () => {
    await Badge.create([
      badgeData({ name: 'Rank Two', ranking: 2 }),
      badgeData({ name: 'Rank One', ranking: 1 }),
      badgeData({ name: 'Other Category', category: 'capstone', ranking: 0 }),
      badgeData({ name: 'Inactive', is_active: false }),
    ]);
    const result = await BadgeService.getAllBadges({ category: 'achievement', page: 2, limit: 1 });
    expect(result.badges.map((badge) => badge.name)).toEqual(['Rank Two']);
    expect(result.pagination).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
  });

  test('rejects case-insensitive duplicate creation and renaming without overwriting records', async () => {
    const first = await BadgeService.createBadge(badgeData());
    const second = await BadgeService.createBadge(badgeData({ name: 'Second Lesson' }));
    await expect(BadgeService.createBadge(badgeData({ name: 'FIRST LESSON' }))).rejects.toThrow(
      'already exists',
    );
    await expect(BadgeService.updateBadge(second._id, { name: 'first lesson' })).rejects.toThrow(
      'already exists',
    );
    await BadgeService.updateBadge(first._id, { name: 'First Lesson' });
    expect(await Badge.countDocuments()).toBe(2);
    expect((await Badge.findById(second._id).lean()).name).toBe('Second Lesson');
  });

  test('enforces model validation for both creation and updates', async () => {
    await expect(BadgeService.createBadge(badgeData({ points: -1 }))).rejects.toThrow(
      'Points cannot be negative',
    );
    const badge = await BadgeService.createBadge(badgeData());
    await expect(BadgeService.updateBadge(badge._id, { image_url: 'invalid' })).rejects.toThrow(
      'Image URL must be a valid',
    );
    expect((await Badge.findById(badge._id).lean()).image_url).toBe(
      'https://example.test/badge.png',
    );
  });

  test('persists an award and populates badge and awarding-user fields when listing', async () => {
    const badge = await BadgeService.createBadge(badgeData());
    const award = await BadgeService.awardBadge({
      studentId: student._id,
      badgeId: badge._id,
      awardedBy: teacher._id,
    });
    expect(award.badge_id.toString()).toBe(badge.id);
    const listed = await BadgeService.getStudentBadges(student._id);
    expect(listed.badges[0].badge_id.name).toBe('First Lesson');
    expect(listed.badges[0].awarded_by.firstname).toBe('Test');
    const stored = await StudentBadge.findById(award._id).lean();
    expect(stored.reason).toBe('manual_award');
    expect(stored.is_revoked).toBe(false);
    await expect(
      BadgeService.awardBadge({ studentId: student._id, badgeId: badge._id }),
    ).rejects.toThrow('already has this badge');
    expect(await StudentBadge.countDocuments()).toBe(1);
  });

  test('revocation hides an award but keeps its history and allows a replacement award', async () => {
    const badge = await BadgeService.createBadge(badgeData());
    const award = await BadgeService.awardBadge({ studentId: student._id, badgeId: badge._id });
    await BadgeService.revokeBadge(award._id, 'Awarded in error');
    const stored = await StudentBadge.findById(award._id).lean();
    expect(stored.is_revoked).toBe(true);
    expect(stored.revoked_at).toBeInstanceOf(Date);
    expect(stored.revoke_reason).toBe('Awarded in error');
    expect((await BadgeService.getStudentBadges(student._id)).badges).toHaveLength(0);
    await BadgeService.awardBadge({ studentId: student._id, badgeId: badge._id });
    expect(await StudentBadge.countDocuments()).toBe(2);
    expect((await BadgeService.getStudentBadges(student._id)).badges).toHaveLength(1);
  });

  test('calculates category statistics and leaderboard points from non-revoked awards', async () => {
    const achievement = await BadgeService.createBadge(badgeData());
    const capstone = await BadgeService.createBadge(
      badgeData({ name: 'Capstone', category: 'capstone', points: 20 }),
    );
    const revoked = await BadgeService.createBadge(
      badgeData({ name: 'Revoked Badge', points: 100 }),
    );
    await BadgeService.awardBadge({ studentId: student._id, badgeId: achievement._id });
    await BadgeService.awardBadge({ studentId: student._id, badgeId: capstone._id });
    const award = await BadgeService.awardBadge({ studentId: student._id, badgeId: revoked._id });
    await BadgeService.revokeBadge(award._id);
    await BadgeService.awardBadge({ studentId: teacher._id, badgeId: achievement._id });
    const stats = await BadgeService.getStudentBadgeStats(student._id);
    expect(stats.totalBadges).toBe(2);
    expect(stats.totalPoints).toBe(30);
    expect(stats.byCategory).toEqual(
      expect.arrayContaining([
        { _id: 'achievement', count: 1, totalPoints: 10 },
        { _id: 'capstone', count: 1, totalPoints: 20 },
      ]),
    );
    const leaders = await BadgeService.getBadgeLeaderboard({ limit: 1 });
    expect(leaders).toHaveLength(1);
    expect(leaders[0].student_id.toString()).toBe(student.id);
    expect(leaders[0].totalPoints).toBe(30);
    const filtered = await BadgeService.getBadgeLeaderboard({ category: 'capstone' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].totalPoints).toBe(20);
  });

  test('automatically awards a capstone and filters the saved award by reason', async () => {
    await BadgeService.createBadge(badgeData({ category: 'capstone' }));
    const metadata = { taskId: 'capstone-1' };
    const award = await BadgeService.awardBadgeOnCompletion(student._id, 'capstone', metadata);
    expect(award.reason).toBe('capstone_completion');
    expect(award.awarded_by).toBeNull();
    expect((await StudentBadge.findById(award._id).lean()).metadata).toEqual(metadata);
    const result = await BadgeService.getStudentBadges(student._id, {
      reason: 'capstone_completion',
    });
    expect(result.badges).toHaveLength(1);
    expect(result.badges[0].badge_id.name).toBe('First Lesson');
    expect(
      (await BadgeService.getStudentBadges(student._id, { reason: 'milestone' })).badges,
    ).toHaveLength(0);
  });
});
