/**
 * Seeder: userProfiles collection
 * - Generates 100 fake users with realistic relationships:
 *   • Pulls badge IDs from badge collection
 *   • Pulls subject IDs from subject collection (for teachers)
 *   • Leaves teams, projects, and applicationAccess blank
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('../models/userProfile');
const Badge = require('../models/badge');
const Subject = require('../models/subject');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedUsersIfEmpty() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`ℹ️ User collection already has ${userCount} users. No seeding needed.`);
      return;
    }

    // Fetch only necessary collections
    const [badges, subjects] = await Promise.all([Badge.find({}, '_id'), Subject.find({}, '_id')]);

    console.log(`📦 Data fetched: ${badges.length} badges, ${subjects.length} subjects.`);

    const roles = ['Owner', 'Admin', 'Volunteer'];
    const usersToInsert = [];

    for (let i = 1; i <= 100; i += 1) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName });
      const phone = faker.phone.number('###-###-####');
      const jobTitle = faker.person.jobTitle();
      const bio = faker.person.bio();
      const role = roles[(i - 1) % roles.length];

      // Random linked data
      const randomBadges = faker.helpers
        .arrayElements(badges, faker.number.int({ min: 1, max: 3 }))
        .map((b) => b._id);
      const randomSubjects = faker.helpers
        .arrayElements(subjects, faker.number.int({ min: 1, max: 3 }))
        .map((s) => s._id);

      usersToInsert.push({
        summarySubmissionDates: [],
        defaultPassword: 'Password123!',
        password: 'Password123!',
        isActive: true,
        isRehireable: true,
        isSet: false,
        finalEmailThreeWeeksSent: false,
        role,
        permissions: {
          isAcknowledged: true,
          frontPermissions: [],
          backPermissions: [],
          removedDefaultPermissions: [],
        },
        firstName,
        lastName,
        phoneNumber: [phone],
        jobTitle: [jobTitle],
        bio,
        email,
        actualEmail: email.toLowerCase(),
        copiedAiPrompt: new Date(),
        emailSubscriptions: faker.datatype.boolean(),
        weeklycommittedHours: faker.number.int({ min: 5, max: 40 }),
        weeklycommittedHoursHistory: [],
        missedHours: faker.number.int({ min: 0, max: 10 }),
        createdDate: new Date(),
        startDate: new Date(),
        isStartDateManuallyModified: false,
        lastModifiedDate: new Date(),
        reactivationDate: undefined,
        personalLinks: [],
        adminLinks: [],
        teams: [], // Leave empty
        projects: [], // Leave empty
        badgeCollection: randomBadges,
        profilePic: faker.image.avatar(),
        suggestedProfilePics: [],
        infringements: [],
        warnings: [],
        location: {
          userProvided: faker.location.streetAddress(),
          coords: { lat: faker.location.latitude(), lng: faker.location.longitude() },
          country: faker.location.country(),
          city: faker.location.city(),
        },
        homeCountry: {
          userProvided: faker.location.streetAddress(),
          coords: { lat: faker.location.latitude(), lng: faker.location.longitude() },
          country: faker.location.country(),
          city: faker.location.city(),
        },
        oldInfringements: [],
        privacySettings: {
          blueSquares: true,
          email: true,
          phoneNumber: true,
        },
        weeklySummaries: [],
        weeklySummariesCount: 0,
        mediaUrl: faker.image.url(),
        endDate: undefined,
        resetPwd: '',
        collaborationPreference: faker.helpers.arrayElement(['Remote', 'Hybrid', 'In-Person']),
        personalBestMaxHrs: faker.number.int({ min: 0, max: 50 }),
        totalTangibleHrs: faker.number.int({ min: 0, max: 500 }),
        totalIntangibleHrs: faker.number.int({ min: 0, max: 500 }),
        hoursByCategory: {
          housing: faker.number.int({ min: 0, max: 100 }),
          food: faker.number.int({ min: 0, max: 100 }),
          education: faker.number.int({ min: 0, max: 100 }),
          society: faker.number.int({ min: 0, max: 100 }),
          energy: faker.number.int({ min: 0, max: 100 }),
          economics: faker.number.int({ min: 0, max: 100 }),
          stewardship: faker.number.int({ min: 0, max: 100 }),
          unassigned: faker.number.int({ min: 0, max: 100 }),
        },
        lastWeekTangibleHrs: faker.number.int({ min: 0, max: 40 }),
        categoryTangibleHrs: [],
        savedTangibleHrs: [],
        timeEntryEditHistory: [],
        weeklySummaryNotReq: faker.datatype.boolean(),
        timeZone: 'America/Los_Angeles',
        isVisible: true,
        weeklySummaryOption: faker.helpers.arrayElement(['Auto', 'Manual', 'None']),
        bioPosted: 'default',
        trophyFollowedUp: faker.datatype.boolean(),
        isFirstTimelog: true,
        badgeCount: randomBadges.length,
        teamCodeWarning: false,
        teamCode: faker.string.alphanumeric({ length: 6 }).toUpperCase(),
        infoCollections: [],
        getWeeklyReport: faker.datatype.boolean(),
        permissionGrantedToGetWeeklySummaryReport: undefined,
        questionaireFeedback: {
          haveYouRecievedHelpLastWeek: faker.helpers.arrayElement(['Yes', 'No']),
          peopleYouContacted: [],
          additionalComments: faker.lorem.sentence(),
          daterequestedFeedback: new Date(),
          foundHelpSomeWhereClosePermanently: faker.datatype.boolean(),
        },
        infringementCCList: [],
        educationProfiles: {
          student: {
            cohortId: undefined,
            enrollmentDate: undefined,
            learningLevel: faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
            strengths: [faker.lorem.word(), faker.lorem.word()],
            challengingAreas: [faker.lorem.word()],
          },
          teacher: {
            subjects: randomSubjects,
            officeHours: `${faker.number.int({ min: 9, max: 17 })}:00 - ${faker.number.int({ min: 18, max: 21 })}:00`,
            assignedStudents: [],
          },
          programManager: {
            managedPrograms: [],
            region: faker.location.state(),
          },
          learningSupport: {
            level: faker.helpers.arrayElement(['junior', 'senior', 'lead']),
            assignedTeachers: [],
          },
        },
      });
    }

    await User.insertMany(usersToInsert);
    console.log('🎉 Successfully seeded 100 fake users with badges and subjects only!');
  } catch (err) {
    console.error('❌ Error while seeding user profiles:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedUsersIfEmpty();
