
const Lessons = require('../../models/bmdashboard/buildingLesson');

const LessonsData = [
    {
      title: 'Lesson 1',
      content: 'This is the content of Lesson 1.',
      author: 123, // Replace with a valid user ID
      tag: ['Tag1', 'Tag2'],
      relatedProject: "65419e61105441587e2dec99", // Replace with a valid project ID
    },
    {
      title: 'Lesson 2',
      content: 'This is the content of Lesson 2.',
      author: 123, // Replace with a valid user ID
      tag: ['Tag3', 'Tag4'],
      relatedProject: "65419e61105441587e2dec99", // Replace with a valid project ID
    },
    // Add more lessons as needed
  ];
const seedDatabase = async () => {
  
    await Lessons.insertMany(LessonsData);

  
    console.log("Lessons Seeded");

  };
seedDatabase()