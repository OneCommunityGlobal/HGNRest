const UserProfile = require('../../models/userProfile');

const createUser = async () => {
  const up = new UserProfile();

  up.password = 'SuperSecretPassword@';
  up.role = 'Administrator';
  up.firstName = 'any_first_name';
  up.lastName = 'any_last_name';
  up.jobTitle = ['any_job_title'];
  up.phoneNumber = ['123456789'];
  up.bio = 'any_bio';
  up.weeklycommittedHours = 21;
  up.weeklycommittedHoursHistory = [
    {
      hours: up.weeklycommittedHours,
      dateChanged: 123,
    },
  ];
  up.personalLinks = [];
  up.adminLinks = [];
  up.teams = [];
  up.projects = [];
  up.createdDate = '2024-02-14T05:00:00.000Z';
  up.email = 'diegoadmin@gmail.com';
  up.weeklySummaries = [{ summary: '' }];
  up.weeklySummariesCount = 0;
  up.weeklySummaryOption = 'Required';
  up.mediaUrl = '';
  up.collaborationPreference = '';
  up.timeZone = 'America/Los_Angeles';
  up.location = {
    userProvided: '',
    coords: {
      lat: null,
      lng: null,
    },
    country: '',
    city: '',
  };
  up.permissions = {
    backPermissions: [],
    frontPermissions: ['addDeleteEditOwners'],
  };
  up.bioPosted = 'default';
  up.isFirstTimelog = true;
  up.actualEmail = '';
  up.isVisible = true;
  up._id = '65cf6c3706d8ac105827bb2e';

  await up.save();
};

module.exports = createUser;
