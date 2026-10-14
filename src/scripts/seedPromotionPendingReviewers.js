/**
 * Dev/test seed: create reviewers that POST /api/promotion-pending will return.
 *
 * Does NOT store any personal login passwords. Seed accounts use SeedTestPass1!
 *
 * Usage (from HGNRest root, with .env loaded like the server):
 *   node src/scripts/seedPromotionPendingReviewers.js
 */
/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const TimeEntry = require('../models/timeentry');
const Task = require('../models/task');
const Project = require('../models/project');
const WBS = require('../models/wbs');
const PromotionEligibility = require('../models/promotionEligibility');
const { mongoWeekOf } = require('../helpers/promotionEligibilityHelper');

const SEED_PASSWORD = 'SeedTestPass1!';
const PROJECT_NAME = 'SEED Promotion Pending Project';

const LEADERS = [
  {
    email: 'seed.promotion.leader.chris@hgn.test',
    firstName: 'Chris',
    lastName: 'Martinez',
    role: 'Manager',
    teamCode: 'SEED1',
  },
  {
    email: 'seed.promotion.leader.sam@hgn.test',
    firstName: 'Sam',
    lastName: 'Patel',
    role: 'Manager',
    teamCode: 'SEED2',
  },
  {
    email: 'seed.promotion.leader.jordan@hgn.test',
    firstName: 'Jordan',
    lastName: 'Lee',
    role: 'Mentor',
    teamCode: 'SEED3',
  },
];

/**
 * Each reviewer needs remainingWeeks === 0 (2 successful past weeks).
 * weeklyPrCounts = reviews per past week (oldest → newer), length >= 2.
 * Override prsNeeded to 1 so any week with >= 1 review counts as successful;
 * higher counts still show as larger badge numbers in the modal.
 */
const REVIEWERS = [
  {
    email: 'seed.promotion.akshay@hgn.test',
    firstName: 'Akshay',
    lastName: 'Jayaram',
    teamCode: 'SEED1',
    weeklyPrCounts: [2, 5, 8, 3],
  },
  {
    email: 'seed.promotion.ghazi@hgn.test',
    firstName: 'Ghazi',
    lastName: 'Tester',
    teamCode: 'SEED2',
    weeklyPrCounts: [7, 10, 4],
  },
  {
    email: 'seed.promotion.diya@hgn.test',
    firstName: 'Diya',
    lastName: 'Pending',
    teamCode: 'SEED3',
    weeklyPrCounts: [1, 3, 6, 9, 2],
  },
  {
    email: 'seed.promotion.ramya@hgn.test',
    firstName: 'Ramya',
    lastName: 'Volunteer',
    teamCode: 'SEED1',
    weeklyPrCounts: [4, 4, 11, 7],
  },
  {
    email: 'seed.promotion.yuhang@hgn.test',
    firstName: 'Yuhang',
    lastName: 'Xu',
    teamCode: 'SEED2',
    weeklyPrCounts: [12, 1],
  },
];

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgoUtc(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

/** Pick N dates in distinct past Mongo weeks (not the current week), oldest first. */
function pastWeekDates(count) {
  const current = mongoWeekOf(new Date());
  const dates = [];
  const seen = new Set();

  for (let days = 7; days <= 120 && dates.length < count; days += 1) {
    const date = daysAgoUtc(days);
    const week = mongoWeekOf(date);
    if (week.year === current.year && week.week === current.week) continue;
    const key = `${week.year}-W${week.week}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dates.push(date);
  }

  if (dates.length < count) {
    throw new Error(`Could not find ${count} distinct past Mongo weeks for seed dates.`);
  }

  // Oldest first so VIBGYOR reads left → right chronologically (matches backend formatWeeklyPRs).
  return dates.reverse();
}

async function connect() {
  const appName = process.env.appName || 'HGNRest';
  const uri = `mongodb+srv://${encodeURIComponent(process.env.user)}:${encodeURIComponent(
    process.env.password,
  )}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`Connected to ${process.env.dbName}`);
}

async function upsertUser({ email, firstName, lastName, role, teamCode }) {
  let user = await UserProfile.findOne({ email });
  if (user) {
    user.firstName = firstName;
    user.lastName = lastName;
    user.role = role;
    user.isActive = true;
    user.teamCode = teamCode;
    user.weeklycommittedHours = 10;
    await user.save();
    console.log(`Updated user ${email}`);
    return user;
  }

  user = await UserProfile.create({
    email,
    firstName,
    lastName,
    role,
    password: SEED_PASSWORD,
    isActive: true,
    isSet: true,
    finalEmailThreeWeeksSent: false,
    teamCode,
    weeklycommittedHours: 10,
    phoneNumber: ['0000000000'],
    jobTitle: ['Volunteer'],
  });
  console.log(`Created user ${email}`);
  return user;
}

async function ensureProjectAndWbs() {
  let project = await Project.findOne({ projectName: PROJECT_NAME });
  if (!project) {
    project = await Project.create({
      projectName: PROJECT_NAME,
      isActive: true,
      createdDatetime: new Date(),
    });
    console.log(`Created project ${PROJECT_NAME}`);
  }

  let wbs = await WBS.findOne({ projectId: project._id, wbsName: 'SEED Promotion WBS' });
  if (!wbs) {
    wbs = await WBS.create({
      wbsName: 'SEED Promotion WBS',
      projectId: project._id,
      isActive: true,
      createdDatetime: new Date(),
    });
    console.log('Created WBS');
  }

  return { project, wbs };
}

async function ensureReviewTask(wbs, label) {
  const taskName = `SEED PR Review ${label}`;
  let task = await Task.findOne({ wbsId: wbs._id, taskName });
  if (task) return task;

  const count = await Task.countDocuments({ wbsId: wbs._id });
  task = await Task.create({
    taskName,
    wbsId: wbs._id,
    num: `SEED-${count + 1}`,
    level: 1,
    position: count + 1,
    isActive: true,
    status: 'Active',
  });
  return task;
}

async function ensureTimeEntry({ personId, projectId, taskId, dateOfWork }) {
  const existing = await TimeEntry.findOne({ personId, taskId, dateOfWork });
  if (existing) {
    existing.isTangible = true;
    existing.totalSeconds = 3600;
    await existing.save();
    return existing;
  }

  return TimeEntry.create({
    entryType: 'default',
    personId,
    projectId,
    taskId,
    dateOfWork,
    totalSeconds: 3600,
    notes: 'SEED promotion pending PR review',
    isTangible: true,
    createdDateTime: new Date(),
    isActive: true,
  });
}

async function clearSeedTimeEntries(personId) {
  await TimeEntry.deleteMany({
    personId,
    notes: 'SEED promotion pending PR review',
  });
}

async function ensureEligibilityOverride(user, totalReviews) {
  await PromotionEligibility.findOneAndUpdate(
    { reviewerId: user._id },
    {
      $set: {
        reviewerName: `${user.firstName} ${user.lastName}`,
        pledgedHours: user.weeklycommittedHours || 10,
        requiredPRs: 1,
        totalReviews,
        successfulWeeks: 2,
        remainingWeeks: 0,
        isNewMember: false,
        weeklyRequirementsMet: true,
        prsNeeded: 1,
        prsNeededSource: 'ownerOverride',
        prsNeededOverride: 1,
        calculatedAt: new Date(),
        isPromoted: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, useFindAndModify: false },
  );
}

async function seedReviewer(reviewer, project, wbs, weekDates) {
  const user = await upsertUser({ ...reviewer, role: 'Volunteer' });
  await clearSeedTimeEntries(user._id);

  const counts = reviewer.weeklyPrCounts;
  let taskIndex = 0;
  let totalReviews = 0;

  for (let weekIndex = 0; weekIndex < counts.length; weekIndex += 1) {
    const dateOfWork = toDateString(weekDates[weekIndex]);
    const reviewsThisWeek = counts[weekIndex];

    for (let n = 0; n < reviewsThisWeek; n += 1) {
      taskIndex += 1;
      const task = await ensureReviewTask(wbs, `${user._id}-${taskIndex}`);
      await ensureTimeEntry({
        personId: user._id,
        projectId: project._id,
        taskId: task._id,
        dateOfWork,
      });
      totalReviews += 1;
    }
  }

  await ensureEligibilityOverride(user, totalReviews);
  console.log(
    `Seeded ${reviewer.firstName} ${reviewer.lastName} (${reviewer.teamCode}) weeks=[${counts.join(
      ', ',
    )}]`,
  );
}

async function seed() {
  await connect();

  const { project, wbs } = await ensureProjectAndWbs();
  const maxWeeks = Math.max(...REVIEWERS.map((r) => r.weeklyPrCounts.length));
  const weekDates = pastWeekDates(maxWeeks);
  console.log(
    'Past week dates (oldest→newest):',
    weekDates.map((d) => `${toDateString(d)} (${JSON.stringify(mongoWeekOf(d))})`).join(', '),
  );

  for (const leader of LEADERS) {
    await upsertUser(leader);
  }

  for (const reviewer of REVIEWERS) {
    await seedReviewer(reviewer, project, wbs, weekDates);
  }

  console.log('\nDone. Refresh and open Promote ? — expect varied team codes, leaders, and PR badges.');
  console.log('Seed login password (test accounts only):', SEED_PASSWORD);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
