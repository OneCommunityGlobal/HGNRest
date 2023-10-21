const UserProfile = require("../models/userProfile");
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const {CronJob} = require('cron');

const response = await axios.get('https://www.onecommunityglobal.org/team/');
const $ = cheerio.load(response.data);
const imgElements = $('img');

const userProfiles = await UserProfile.find();

userProfiles.forEach((userProfile) => {
  const {firstName, lastName} = userProfile;

  imgElements.each((index, element) => {
    const imgAlt = $(element).attr('alt');
    if (imgAlt && imgAlt.toLowerCase().includes(firstName.toLowerCase()) && imgAlt.toLowerCase().includes(lastName.toLowerCase())) {
      userProfile.profilePic = $(element).attr('src');
      userProfile.save((saveErr) => {
        if (saveErr) {
          console.error('Error saving user profile:', saveErr);
        }
      });
    }
  });
});

console.log('Profiles updated successfully');
