const {chromium} = require('playwright');
const mongoose = require('mongoose');
const logger = require('../startup/logger');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');

mongoose.Promise = Promise;

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne({
      firstName: {$regex: process.env.TIME_ARCHIVE_FIRST_NAME, $options: 'i'},
      lastName: {$regex: process.env.TIME_ARCHIVE_LAST_NAME, $options: 'i'},
    });

    await initialPermissions();
    if (!user) {
      userProfile
        .create({
          firstName: process.env.TIME_ARCHIVE_FIRST_NAME,
          lastName: process.env.TIME_ARCHIVE_LAST_NAME,
          email: process.env.TIME_ARCHIVE_EMAIL,
          role: 'Volunteer',
          password: process.env.DEF_PWD,
        })
        .then((result) =>
          logger.logInfo(`TimeArchive account was created with id of ${result._id}`)
        )
        .catch((error) => logger.logException(error));
    }
  } catch (error) {
    throw new Error(error);
  }
};

const updateProfilesPic = async () => {
  try {
    const uri = `mongodb://${'hgnData_Dev'}:${encodeURIComponent('hgnDataDev123!!')}@${'hgnproddb-shard-00-00-ict1p.mongodb.net:27017'}/${'hgnData_dev'}?ssl=true&replicaSet=${'HGNProdDB-shard-0'}&authSource=admin`;
    mongoose
      .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
      })
      .then(afterConnect)
      .catch((err) => logger.logException(err));

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://www.katfun.com/profiles', {waitUntil: 'networkidle'}); // Wait for network to be idle

    const response = await page.content();
    await browser.close();

    // Now you can parse the response with Cheerio
    const cheerio = require('cheerio');
    const $ = cheerio.load(response);
    const imgElements = $('img');
    const userProfiles = await userProfile.find({
      firstName: 'Haoji',
    });

    imgElements.each((index, element) => {
      const imgAlt = $(element).attr('alt');
      const imgSrc = $(element).attr('src'); // Use 'src' attribute instead of 'nitro-lazy-src'

      console.log(`Image ${index + 1}:`);
      console.log(`Alt: ${imgAlt}`);
      console.log(`Src: ${imgSrc}`);
    });

    userProfiles.forEach((userProfile) => {
      const {firstName, lastName} = userProfile;
      let pictureList = [];
      imgElements.each((index, element) => {
        const imgAlt = $(element).attr('alt');
        if (
          imgAlt &&
          imgAlt.toLowerCase().includes(firstName.toLowerCase()) &&
          imgAlt.toLowerCase().includes(lastName.toLowerCase())
        ) {
          pictureList.push($(element).attr('src'));
          userProfile.profilePic = $(element).attr('src'); // Use 'src' attribute instead of 'nitro-lazy-src'
          userProfile.save((saveErr) => {
            if (saveErr) {
              console.error('Error saving user profile:', saveErr);
            }
          });
          console.log(`${imgAlt} updated`);
        } else if (imgAlt &&
          imgAlt.toLowerCase().includes(lastName.toLowerCase())
        ) {
          pictureList.push($(element).attr('src'));
          userProfile.profilePic = $(element).attr('src'); // Use 'src' attribute instead of 'nitro-lazy-src'
          userProfile.save((saveErr) => {
            if (saveErr) {
              console.error('Error saving user profile:', saveErr);
            }
          });
          console.log(`${imgAlt} updated`);
        }
      });
    });

    console.log('Profiles updated successfully');
  } catch (error) {
    console.error('Error updating profiles:', error);
  }
};

updateProfilesPic();
