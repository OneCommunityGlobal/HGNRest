const mongoose = require('mongoose');
const userProfile = require('../../models/userProfile');
const userHelper = require('../userHelper')();

// Connect to database. beforeAll function is a lifecycle function provided by Jest to run setup code before any tests in test suite are executed.
beforeAll(async () => {
  await require('dotenv').load();
  await require('../../startup/db')();
}, 10000);

// Disconnect from the database. afterAll function is a lifecycle function provided by Jest to run teardown code after all tests in test suite have been executed.
afterAll(async () => {
  await mongoose.disconnect();
}, 10000);


async function initializeTestUser() {
  await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  await userProfile.create({
    firstName: 'CheckXHrsForXWeeks',
    lastName: 'TestUser',
    email: 'CheckXHrsForXWeeks.TestUser@email.com',
    role: 'Volunteer',
    password: 'Welcome123!',
  });
}

async function setLastWeekTangibleHrs(hrs) {
  // Modify the user's lastWeekTangibleHrs
  await userProfile.findOneAndUpdate(
    { email: 'CheckXHrsForXWeeks.TestUser@email.com' },
    {
      $set: {
      lastWeekTangibleHrs: hrs,
      },
    },
  );
}

async function setSavedTangibleHrs(hrsArr) {
  // Modify the user's savedTangibleHrs
  await userProfile.findOneAndUpdate(
    { email: 'CheckXHrsForXWeeks.TestUser@email.com' },
    {
      $set: {
      savedTangibleHrs: hrsArr,
      },
    },
  );
}

async function pushSavedTangibleHrs(hrs) {
  // Modify the user's savedTangibleHrs and lastWeekTangibleHrs
  await userProfile.findOneAndUpdate(
    { email: 'CheckXHrsForXWeeks.TestUser@email.com' },
    { $push: { savedTangibleHrs: hrs } },
  );
}

async function callCheckXHrsForXWeeks() {
  const testUser = await userProfile.findOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' }).populate('badgeCollection.badge');
  const { _id, badgeCollection } = testUser;
  const personId = mongoose.Types.ObjectId(_id);

  await userHelper.checkXHrsForXWeeks(personId, testUser, badgeCollection);
}
async function isBadgeInBadgeCollection(badgeObj) {
  const testUser = await userProfile.findOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' }).populate('badgeCollection.badge');
  // transform badgeCollection to better format for testing
  const modifiedBadgeCollection = [];
  for (const badgeObject of testUser.badgeCollection) {
    modifiedBadgeCollection.push({ count: badgeObject.count, badgeName: badgeObject.badge.badgeName })
  };

  for (const obj of modifiedBadgeCollection) {
    if (obj['count'] === badgeObj['count'] && obj['badgeName'] === badgeObj['badgeName']) return true;
  };
  return false;
}

async function getBadgeCollectionLength() {
  const testUser = await userProfile.findOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' }).populate('badgeCollection.badge');
  return testUser.badgeCollection.length;
}

describe('CheckXHrsForXWeeks() Test', () => {
  test('[90] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();

    const res = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(res).toBe(true);

    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(1);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 80] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(80);
    await pushSavedTangibleHrs(80);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has80HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '80 HOURS IN 1 WEEK' });
    expect(has80HrsIn1WkBadge).toBe(true);
    const has60HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS 2-WEEK STREAK' });
    expect(has60HrsIn2WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(3);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has60HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS 2-WEEK STREAK' });
    expect(has60HrsIn2WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(3);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has50HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS 3-WEEK STREAK' });
    expect(has50HrsIn3WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(4);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 40] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has50HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS 3-WEEK STREAK' });
    expect(has50HrsIn3WkBadge).toBe(false);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(4);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 30] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has50HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS 3-WEEK STREAK' });
    expect(has50HrsIn3WkBadge).toBe(false);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(4);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 30, 30] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(false);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(4);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 30, 30, 0] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(false);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(4);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 30, 30, 0, 30, 31] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(false);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const has30HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 2-WEEK STREAK' });
    expect(has30HrsIn2WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(5);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 10000);
  test('[90, 60, 50, 30, 30, 0, 30, 31, 32] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(32);
    await pushSavedTangibleHrs(32);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(false);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const has30HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 2-WEEK STREAK' });
    expect(has30HrsIn2WkBadge).toBe(false);
    const has30HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 3-WEEK STREAK' });
    expect(has30HrsIn3WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(5);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 15000);
  test('[90, 60, 50, 30, 30, 0, 30, 31, 32, 0, 30, 31] test', async () => {
    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(32);
    await pushSavedTangibleHrs(32);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has40HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 4-WEEK STREAK' });
    expect(has40HrsIn4WkBadge).toBe(false);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const has30HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 3-WEEK STREAK' });
    expect(has30HrsIn3WkBadge).toBe(true);
    const has30HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 2-WEEK STREAK' });
    expect(has30HrsIn2WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(6);

    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 15000);
});

describe('Getting awarded badges that user already had', () => {
  test('[90, 60, 50, 40, 30, 30, 0, 30, 31, 32, 0, 30, 31, 40] test', async () => {

    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(32);
    await pushSavedTangibleHrs(32);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has30HrsIn6WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn6WkBadge).toBe(true);
    const has30HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 2, badgeName: '30 HOURS 3-WEEK STREAK' });
    expect(has30HrsIn3WkBadge).toBe(true);
    const has30HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 2-WEEK STREAK' });
    expect(has30HrsIn2WkBadge).toBe(false);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(5);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 15000);
  test('[90, 60, 50, 40, 30, 30, 0, 30, 31, 32, 0, 30, 31, 40, 41] test', async () => {

    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(32);
    await pushSavedTangibleHrs(32);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(41);
    await pushSavedTangibleHrs(41);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has30HrsIn6WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn6WkBadge).toBe(true);
    const has30HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 3-WEEK STREAK' });
    expect(has30HrsIn3WkBadge).toBe(true);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 4-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const has40HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 2-WEEK STREAK' });
    expect(has40HrsIn2WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(7);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 30000);
  test.skip('[90, 60, 50, 40, 30, 30, 0, 30, 31, 32, 0, 30, 31, 40, 41, 42] test', async () => {

    await initializeTestUser();

    await setLastWeekTangibleHrs(90);
    await setSavedTangibleHrs([90]);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(60);
    await pushSavedTangibleHrs(60);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(50);
    await pushSavedTangibleHrs(50);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(32);
    await pushSavedTangibleHrs(32);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(0);
    await pushSavedTangibleHrs(0);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(30);
    await pushSavedTangibleHrs(30);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(31);
    await pushSavedTangibleHrs(31);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(40);
    await pushSavedTangibleHrs(40);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(41);
    await pushSavedTangibleHrs(41);
    await callCheckXHrsForXWeeks();
    await setLastWeekTangibleHrs(42);
    await pushSavedTangibleHrs(42);
    await callCheckXHrsForXWeeks();

    const has90HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '90 HOURS IN 1 WEEK' });
    expect(has90HrsIn1WkBadge).toBe(true);
    const has60HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '60 HOURS IN 1 WEEK' });
    expect(has60HrsIn1WkBadge).toBe(true);
    const has50HrsIn1WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '50 HOURS IN 1 WEEK' });
    expect(has50HrsIn1WkBadge).toBe(true);
    const has30HrsIn6WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 6-WEEK STREAK' });
    expect(has30HrsIn6WkBadge).toBe(true);
    const has30HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 3-WEEK STREAK' });
    expect(has30HrsIn3WkBadge).toBe(true);
    const has30HrsIn4WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '30 HOURS 4-WEEK STREAK' });
    expect(has30HrsIn4WkBadge).toBe(true);
    const has40HrsIn2WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 2-WEEK STREAK' });
    expect(has40HrsIn2WkBadge).toBe(false);
    const has40HrsIn3WkBadge = await isBadgeInBadgeCollection({ count: 1, badgeName: '40 HOURS 3-WEEK STREAK' });
    expect(has40HrsIn3WkBadge).toBe(true);
    const badgeCollectionLength = await getBadgeCollectionLength();
    expect(badgeCollectionLength).toBe(7);


    await userProfile.deleteOne({ email: 'CheckXHrsForXWeeks.TestUser@email.com' });
  }, 30000);
})