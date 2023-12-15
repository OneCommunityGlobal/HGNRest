const mongoose = require('mongoose');
const logger = require('./logger');
const userProfile = require('../models/userProfile');
const initialPermissions = require('../utilities/createInitialPermissions');

mongoose.Promise = Promise;

const seedDatabase = async () => {
  try {
    const Lessons = require('../models/bmdashboard/buildingLesson');
    const LessonLikes = require('../models/bmdashboard/buildingLessonLike');
    const LessonsData = [
      {
        title: 'Lesson 1',
        content: 'This is the content of Lesson 1.',
        author: '652ef81ccf71ca5032fa5acf', // Replace with a valid user ID
        tag: ['Tag1', 'Tag2'],
        relatedProject: "65419e61105441587e2dec99", // Replace with a valid project ID
      },
      {
        title: 'Lesson 2',
        content: 'This is the content of Lesson 2.',
        author: '652ef81ccf71ca5032fa5acf', // Replace with a valid user ID
        tag: ['Tag3', 'Tag4'],
        relatedProject: "65419e61105441587e2dec99", // Replace with a valid project ID
      },
    ];
    await Lessons.deleteMany()
    await LessonLikes.deleteMany()
    await Lessons.insertMany(LessonsData);

    console.log("Lessons Seeded");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

const afterConnect = async () => {
  try {
    const user = await userProfile.findOne({
      firstName: { $regex: process.env.TIME_ARCHIVE_FIRST_NAME, $options: 'i' },
      lastName: { $regex: process.env.TIME_ARCHIVE_LAST_NAME, $options: 'i' },
    });

    await initialPermissions();
    if (!user) {
      userProfile.create({
        firstName: process.env.TIME_ARCHIVE_FIRST_NAME,
        lastName: process.env.TIME_ARCHIVE_LAST_NAME,
        email: process.env.TIME_ARCHIVE_EMAIL,
        role: 'Volunteer',
        password: process.env.DEF_PWD,
      })
        .then(result => logger.logInfo(`TimeArchive account was created with id of ${result._id}`))
        .catch(error => logger.logException(error));
    }

    // Seed the database after user creation
    await seedDatabase();
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = function () {
  const uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin`;

  mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
    .then(afterConnect)
    .catch(err => logger.logException(err));
};

