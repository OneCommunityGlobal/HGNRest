const formquestions = [
  { title: "user_info", subject: "name", text: "Name", page: "1" },
  { title: "user_info", subject: "email", text: "Email", page: "1" },
  { title: "user_info", subject: "github", text: "GitHub", page: "1" },
  { title: "user_info", subject: "slack", text: "Slack", page: "1" },
  { title: "general", subject: "hours", text: "Which of the following best describes your weekly volunteer hours commitment with One Community?", page: "2", qno:1 },
  { title: "general", subject: "period", text: "How much longer do you anticipate volunteering with us?", page: "2", qno:2  },
  { title: "general", subject: "standup", text: "Would you be interested in weekly (or biweekly) standup meetings to discuss coding and your progress?", page: "2", qno:3 },
  { title: "general", subject: "location", text: "Confirm your location for the foreseeable future so we can confirm the time zones for these meetings (Answer format: City, State, Country)", page: "2", qno:4 },
  { title: "general", subject: "manager", text: "Are you interested in managing a team or doing any management work?", page: "2", qno:5},
  { title: "general", subject: "combined_frontend_backend", text: "How would you rate your combined frontend/backend skills as a developer? (1-10, 10 being the highest)", page: "2", qno:6 },
  { title: "general", subject: "mern_skills", text: "How would you score yourself on MERN (MongoDB, Express, React, Node) stack development? (1-10, 10 being the highest)", page: "2", qno:7 },
  { title: "general", subject: "leadership_skills", text: "How would you rate your overall leadership/management/people SKILLS? (1-10, 10 being the highest)", page: "2", qno:8 },
  { title: "general", subject: "leadership_experience", text: "How would you rate your overall leadership/management EXPERIENCE? (1-10, 10 being the highest)", page: "2", qno:9},
  { title: "general", subject: "preferences", text: "Do you have any preference where you'd like to put your energy?", page: "2", qno:10 },
  { title: "general", subject: "availability", text: "Confirm your availability in PACIFIC TIMEZONE (PT)", page: "2", qno:11 },
  { title: "frontend", subject: "overall", text: "How would you score yourself overall on the frontend (1-10, ten being the highest)? Including JavaScript, React.js, HTML/CSS, etc.", page: "3", qno:1 },
  { title: "frontend", subject: "HTML", text: "How would you score yourself on your understanding of HTML semantics and best practices (1-10, ten being the highest)?", page: "3", qno:2 },
  { title: "frontend", subject: "Bootstrap", text: "How would you score yourself on your understanding of Bootstrap (1-10, ten being the highest)?", page: "3", qno:3 },
  { title: "frontend", subject: "CSS", text: "How would you score yourself on your understanding of advanced CSS techniques (1-10, ten being the highest)? (grid, flex box, clamp, media queries, transitions & animations, pseudo-classes & pseudo elements, advanced selectors, preprocessors, cross-browser compatibility, optimization, and performance)", page: "3", qno:4 },
  { title: "frontend", subject: "React", text: "How would you score yourself on your understanding and ability to utilize advanced features of React (1-10, ten being the highest)?", page: "3", qno:5 },
  { title: "frontend", subject: "Redux", text: "How would you score yourself on your understanding and ability to advanced features of Redux (1-10, ten being the highest)?", page: "3", qno:6 },
  { title: "frontend", subject: "WebSocketCom", text: "On a scale of 1-10, how comfortable are you integrating web socket communications in the front end?", page: "3", qno:7 },
  { title: "frontend", subject: "ResponsiveUI", text: "How would you score yourself on responsive web design and UI development (1-10, ten being the highest)?", page: "3", qno:8 },
  { title: "frontend", subject: "UnitTest", text: "How would you score yourself on testing (1-10, ten being the highest)? Like Unit Testing with Jest or RTL.", page: "3", qno:9 },
  { title: "frontend", subject: "Documentation", text: "How would you score yourself on documentation (1-10, ten being the highest)? Like writing Markdown files and drawing all kinds of graphs during design and development.", page: "3", qno:10 },
  { title: "frontend", subject: "UIUXTools", text: "How would you score yourself on UX/UI design (1-10, ten being the highest)? With tools like Figma.", page: "3", qno:11 },
  { title: "backend", subject: "Overall", text: "How would you score yourself on the backend (1-10, ten being the highest)? Including advanced JavaScript coding and debugging.", page: "4", qno:1 },
  { title: "backend", subject: "Database", text: "How would you score yourself on database (1-10, ten being the highest)? Including advanced topics like aggregation, setup, etc.", page: "4", qno:2 },
  { title: "backend", subject: "MongoDB", text: "How would you score yourself on using MongoDB in relation to setup, advanced query calls, and handling of data (1-10, ten being the highest)?", page: "4", qno:3 },
  { title: "backend", subject: "MongoDB_Advanced", text: "How would you score yourself on your ability to create a mock MongoDB database and integrate that into your backend testing in order to create a more robust backend (1-10, ten being the highest)?", page: "4", qno:4 },
  { title: "backend", subject: "TestDrivenDev", text: "How would you score yourself on test driven development in the backend (1-10, ten being the highest)?", page: "4", qno:5 },
  { title: "backend", subject: "Deployment", text: "How would you score yourself on deployment (1-10, ten being the highest)? With tools like Azure, Docker, Bluehost, CicleCI, surge CDN, etc.", page: "4", qno:6 },
  { title: "backend", subject: "VersionControl", text: "How would you score yourself on version control (1-10, ten being the highest)? Including advanced topics like rebase, patch, stash, cherry-picking, etc.", page: "4", qno:7 },
  { title: "backend", subject: "CodeReview", text: "How would you score yourself on advanced code review skills (1-10, ten being the highest)? Like finding the root causes of bugs and giving suggestions to improve the author’s code, either on functionalities or the codes performance.", page: "4", qno:8 },
  { title: "backend", subject: "EnvironmentSetup", text: "How would you score yourself on environment setup on Windows or Linux (Unix) (1-10, ten being the highest)? With knowledge in scripting language like Shell.", page: "4", qno:9 },
  { title: "backend", subject: "AdvancedCoding", text: "How would you score yourself on advanced coding skills (1-10, ten being the highest)? Like software design, performance improvement, code cleaning-up, etc.", page: "4", qno:10 },
  { title: "backend", subject: "AgileDevelopment", text: "How would you score yourself on Agile development (1-10, ten being the highest)? With tools like Jira, Bamboo, etc.", page: "4", qno:11 },
  { title: "followup", subject: "platform",  text: "What platform are you using for developing? (Windows, macOS, Linux, etc)", page: "5", qno:1 },
  { title: "followup", subject: "other_skills", text: "Do you have experience in any other technical skills we might use in future? Like data analysis, machine learning, etc.", page: "5", qno:2 },
  { title: "followup", subject: "suggestion", text: "Is there anything else you think we've missed and/or that you suggest we should add here?", page: "5", qno:3 },
  { title: "followup", subject: "additional_info", text: "Is there anything else you'd like to share with us?", page: "5", qno:4 },
];

const getSkillsList = () =>
  formquestions.filter((ele) => {
    const { title, subject } = ele;
    if (title === 'frontend' || title === 'backend') {
      if (subject.trim().toLowerCase() !== 'overall') {
        return true;
      }
    }
    return false;
  });

module.exports = formquestions;
module.exports.getSkillsList=  getSkillsList;