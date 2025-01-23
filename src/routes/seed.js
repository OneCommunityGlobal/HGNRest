const mongoose = require("mongoose");
const Question = require("./models/Question");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;

const seedQuestions = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Grouped questions by category
    const pageQuestions = {
      page1: [
        { title: "user_info", text: "Name" },
        { title: "user_info", text: "Email" },
        { title: "user_info", text: "GitHub" },
        { title: "user_info", text: "Slack" },
      ],
      page2: [
        {
          title: "general",
          text: "Which of the following best describes your weekly volunteer hours commitment with One Community?",
        },
        {
          title: "general",
          text: "How much longer do you anticipate volunteering with us?",
        },
        {
          title: "general",
          text: "Would you be interested in weekly (or biweekly) standup meetings to discuss coding and your progress?",
        },
        {
          title: "general",
          text: "Confirm your location for the foreseeable future so we can confirm the time zones for these meetings (Answer format: City, State, Country)",
        },
        {
          title: "general",
          text: "Are you interested in managing a team or doing any management work?",
        },
        {
          title: "general",
          text: "How would you rate your combined frontend/backend skills as a developer? (1-10, 10 being the highest)",
        },
        {
          title: "general",
          text: "How would you rate your combined skills as a developer? (1-10, 10 being the highest)",
        },
        {
          title: "general",
          text: "How would you score yourself on MERN (MongoDB, Express, React, Node) stack development? (1-10, 10 being the highest)",
        },
        {
          title: "general",
          text: "How would you rate your overall leadership/management/people SKILLS? (1-10, 10 being the highest)",
        },
        {
          title: "general",
          text: "How would you rate your overall leadership/management EXPERIENCE? (1-10, 10 being the highest)",
        },
        {
          title: "general",
          text: "Do you have any preference where you'd like to put your energy?",
        },
        {
          title: "general",
          text: "Confirm your availability in PACIFIC TIMEZONE (PT)",
        },
      ],
      page3: [
        {
          title: "frontend",
          text: "How would you score yourself overall on the frontend (1-10, ten being the highest)? Including JavaScript, React.js, HTML/CSS, etc.",
        },
        {
          title: "frontend",
          text: "How would you score yourself on your understanding of HTML semantics and best practices (1-10, ten being the highest)?",
        },
        {
          title: "frontend",
          text: "How would you score yourself on your understanding of Bootstrap (1-10, ten being the highest)?",
        },
        {
          title: "frontend",
          text: "How would you score yourself on your understanding of advanced CSS techniques (1-10, ten being the highest)? (grid, flex box, clamp, media queries, transitions & animations, pseudo-classes & pseudo elements, advanced selectors, preprocessors, cross-browser compatibility, optimization, and performance)",
        },
        {
          title: "frontend",
          text: "How would you score yourself on your understanding and ability to utilize advanced features of React (1-10, ten being the highest)?",
        },
        {
          title: "frontend",
          text: "How would you score yourself on your understanding and ability to advanced features of Redux (1-10, ten being the highest)?",
        },
        {
          title: "frontend",
          text: "On a scale of 1-10, how comfortable are you integrating web socket communications in the front end?",
        },
        {
          title: "frontend",
          text: "How would you score yourself on responsive web design and UI development (1-10, ten being the highest)?",
        },
        {
          title: "frontend",
          text: "How would you score yourself on testing (1-10, ten being the highest)? Like Unit Testing with Jest or RTL.",
        },
        {
          title: "frontend",
          text: "How would you score yourself on documentation (1-10, ten being the highest)? Like writing Markdown files and drawing all kinds of graphs during design and development.",
        },
        {
          title: "frontend",
          text: "How would you score yourself on UX/UI design (1-10, ten being the highest)? With tools like Figma.",
        },
      ],
      page4: [
        {
          title: "backend",
          text: "How would you score yourself on the backend (1-10, ten being the highest)? Including advanced JavaScript coding and debugging.",
        },
        {
          title: "backend",
          text: "How would you score yourself on database (1-10, ten being the highest)? Including advanced topics like aggregation, setup, etc.",
        },
        {
          title: "backend",
          text: "How would you score yourself on using MongoDB in relation to setup, advanced query calls, and handling of data (1-10, ten being the highest)?",
        },
        {
          title: "backend",
          text: "How would you score yourself on your ability to create a mock MongoDB database and integrate that into your backend testing in order to create a more robust backend (1-10, ten being the highest)?",
        },
        {
          title: "backend",
          text: "How would you score yourself on test driven development in the backend (1-10, ten being the highest)?",
        },
        {
          title: "backend",
          text: "How would you score yourself on deployment (1-10, ten being the highest)? With tools like Azure, Docker, Bluehost, CicleCI, surge CDN, etc.",
        },
        {
          title: "backend",
          text: "How would you score yourself on version control (1-10, ten being the highest)? Including advanced topics like rebase, patch, stash, cherry-picking, etc.",
        },
        {
          title: "backend",
          text: "How would you score yourself on advanced code review skills (1-10, ten being the highest)? Like finding the root causes of bugs and giving suggestions to improve the author’s code, either on functionalities or the codes performance.",
        },
        {
          title: "backend",
          text: "How would you score yourself on environment setup on Windows or Linux (Unix) (1-10, ten being the highest)? With knowledge in scripting language like Shell.",
        },
        {
          title: "backend",
          text: "How would you score yourself on advanced coding skills (1-10, ten being the highest)? Like software design, performance improvement, code cleaning-up, etc.",
        },
        {
          title: "backend",
          text: "How would you score yourself on Agile development (1-10, ten being the highest)? With tools like Jira, Bamboo, etc.",
        },
      ],
      page5: [
        {
          title: "followup",
          text: "What platform are you using for developing? (Windows, macOS, Linux, etc)",
        },
        {
          title: "followup",
          text: "Do you have experience in any other technical skills we might use in future? Like data analysis, machine learning, etc.",
        },
        {
          title: "followup",
          text: "Is there anything else you think we've missed and/or that you suggest we should add here?",
        },
        {
          title: "followup",
          text: "Is there anything else you'd like to share with us?",
        },
      ],
    };

    // Flatten questions and add page numbers
    const questions = Object.entries(pageQuestions).flatMap(
      ([pageKey, questionsArray], index) =>
        questionsArray.map((question) => ({ ...question, page: index + 1 }))
    );

    // Clear existing questions to prevent duplicates
    await Question.deleteMany({});
    console.log("Existing questions cleared.");

    // Insert the new questions into the database
    await Question.insertMany(questions);
    console.log("Questions seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding questions:", err);
    process.exit(1);
  }
};

seedQuestions();
