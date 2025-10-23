const User = require('../models/userProfile');
const { dbConnect } = require('../test/db/mongo-helper');

async function seedUsersIfEmpty() {
  try {
    await dbConnect(); // Use the shared connection helper
    console.log('✅ Connected to MongoDB');

    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`ℹ️ User collection already has ${userCount} users. No seeding needed.`);
      process.exit(0);
    }

    const roles = ['Owner', 'Admin', 'Volunteer'];
    const usersToInsert = [];
    for (let i = 1; i <= 50; i += 1) {
      usersToInsert.push({
        summarySubmissionDates: [],
        defaultPassword: 'Password123!',
        password: 'Password123!',
        isActive: true,
        isRehireable: true,
        isSet: false,
        finalEmailThreeWeeksSent: false,
        role: roles[(i - 1) % roles.length], // Assign role in round-robin fashion
        permissions: {
          isAcknowledged: true,
          frontPermissions: [],
          backPermissions: [],
          removedDefaultPermissions: [],
        },
        firstName: `User${i}`,
        lastName: `Test${i}`,
        phoneNumber: [`123-456-78${i.toString().padStart(2, '0')}`],
        jobTitle: [`Tester${i}`],
        bio: `This is a test user ${i}.`,
        email: `user${i}@example.com`,
        copiedAiPrompt: new Date(),
        emailSubscriptions: false,
        weeklycommittedHours: 10,
        weeklycommittedHoursHistory: [],
        missedHours: 0,
        createdDate: new Date(),
        startDate: new Date(),
        isStartDateManuallyModified: false,
        lastModifiedDate: new Date(),
        reactivationDate: undefined,
        personalLinks: [],
        adminLinks: [],
        teams: [],
        projects: [],
        badgeCollection: [],
        profilePic: '',
        suggestedProfilePics: [],
        infringements: [],
        warnings: [],
        location: {
          userProvided: '',
          coords: { lat: '', lng: '' },
          country: '',
          city: '',
        },
        homeCountry: {
          userProvided: '',
          coords: { lat: '', lng: '' },
          country: '',
          city: '',
        },
        oldInfringements: [],
        privacySettings: {
          blueSquares: true,
          email: true,
          phoneNumber: true,
        },
        weeklySummaries: [],
        weeklySummariesCount: 0,
        mediaUrl: '',
        endDate: undefined,
        resetPwd: '',
        collaborationPreference: '',
        personalBestMaxHrs: 0,
        totalTangibleHrs: 0,
        totalIntangibleHrs: 0,
        hoursByCategory: {
          housing: 0,
          food: 0,
          education: 0,
          society: 0,
          energy: 0,
          economics: 0,
          stewardship: 0,
          unassigned: 0,
        },
        lastWeekTangibleHrs: 0,
        categoryTangibleHrs: [],
        savedTangibleHrs: [],
        timeEntryEditHistory: [],
        weeklySummaryNotReq: false,
        timeZone: 'America/Los_Angeles',
        isVisible: true,
        weeklySummaryOption: '',
        bioPosted: 'default',
        trophyFollowedUp: false,
        isFirstTimelog: true,
        badgeCount: 0,
        teamCodeWarning: false,
        teamCode: '',
        infoCollections: [],
        actualEmail: '',
        timeOffFrom: undefined,
        timeOffTill: undefined,
        getWeeklyReport: false,
        permissionGrantedToGetWeeklySummaryReport: undefined,
        applicationAccess: undefined,
        questionaireFeedback: {
          haveYouRecievedHelpLastWeek: 'No',
          peopleYouContacted: [],
          additionalComments: '',
          daterequestedFeedback: new Date(),
          foundHelpSomeWhereClosePermanently: false,
        },
        infringementCCList: [],
        educationProfiles: {
          student: {
            cohortId: undefined,
            enrollmentDate: undefined,
            learningLevel: 'beginner',
            strengths: [],
            challengingAreas: [],
          },
          teacher: {
            subjects: [],
            officeHours: '',
            assignedStudents: [],
          },
          programManager: {
            managedPrograms: [],
            region: '',
          },
          learningSupport: {
            level: 'junior',
            assignedTeachers: [],
          },
        },
      });
    }

    await User.insertMany(usersToInsert);
    console.log('🎉 Seeded 50 users with roles Owner, Admin, Volunteer!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while seeding:', err);
    process.exit(1);
  }
}

seedUsersIfEmpty();
