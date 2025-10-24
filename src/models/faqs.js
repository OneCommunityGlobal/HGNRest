const mongoose = require('mongoose');
const { Schema } = mongoose;

const faqSchema = new Schema({
    question: { type: String, required: true },
    answer: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    changeHistory: [
        {
            updatedBy: { type: Schema.Types.ObjectId, ref: 'userProfile' },
            updatedAt: { type: Date, default: Date.now },
            previousQuestion: String,
            previousAnswer: String,
            updatedQuestion: String,
            updatedAnswer: String,
        },
    ],
});

const FAQ = mongoose.model('FAQ', faqSchema, 'FAQs');

const defaultFAQs = [
    { question: "What is One Community Global?", answer: "One Community Global is a fully volunteer-run nonprofit organization dedicated to creating an open-source model for a sustainable and collaborative world." },
    { question: "What is the mission of One Community Global?", answer: "Our mission is to facilitate global sustainability and cooperation through open-source and self-replicating solutions." },
    { question: "How can I get involved with One Community Global?", answer: "You can participate by filling out our Volunteer and Consultant Interest Form, which helps us understand your skills and how you can contribute." },
    { question: "What volunteer opportunities are available?", answer: "We are looking for professionals and experienced individuals in areas such as food, energy, housing, education, economy, and social development." },
    { question: "Are specific skills required to volunteer?", answer: "Yes, we seek volunteers with expertise that aligns with our action lists and work breakdown structures." },
    { question: "Is there a minimum time commitment for volunteers?", answer: "Yes, volunteers are expected to commit at least 10 hours per week for a minimum of 6 months." },
    { question: "Can organizations collaborate with One Community Global?", answer: "Yes, organizations can partner with us by contributing resources, expertise, or by working with us on specific sustainability initiatives." },
    { question: "How can businesses partner with One Community Global?", answer: "Businesses can collaborate by sponsoring projects, providing resources, or supporting us through knowledge-sharing and expertise." },
    { question: "What is the process for becoming a consultant with One Community Global?", answer: "Interested consultants should fill out the Volunteer and Consultant Interest Form, specifying their area of expertise and availability." },
    { question: "Are internship opportunities available?", answer: "While we do not offer formal internships, students can participate in volunteer roles that align with their academic interests and career goals." },
    { question: "Does One Community Global offer remote volunteering options?", answer: "Yes, most of our work is remote, allowing volunteers from around the world to contribute online." },
    { question: "How can I apply to become a community member?", answer: "You can apply by filling out the Community Member Invitation Form, which outlines the expectations and commitment required." },
    { question: "What is the Community Member Invitation Form?", answer: "It is an application process for individuals who want to become deeply involved in our core team and long-term initiatives." },
    { question: "Where can I find the Volunteer and Consultant Interest Form?", answer: "The form is available on our website under the Collaboration section." },
    { question: "What is the expected response time after submitting an interest form?", answer: "We typically review applications within 1-2 weeks, and selected candidates will be contacted for further discussion." },
    { question: "Are there any age restrictions for volunteers?", answer: "Yes, volunteers must be 18 years or older to participate in our projects." },
    { question: "Can I contribute to One Community Global if I have limited availability?", answer: "While we prioritize volunteers with a 10-hour weekly commitment, we welcome contributions of any size, including short-term project-based assistance." },
    { question: "How does One Community Global support its volunteers and consultants?", answer: "We provide clear project guidelines, collaborative tools, and regular communication to ensure all volunteers have the resources needed to succeed." },
    { question: "What are the benefits of collaborating with One Community Global?", answer: "Volunteers and collaborators gain experience in sustainability, contribute to meaningful global projects, and join a network of like-minded individuals." },
    { question: "How can I stay updated on One Community Global's projects and initiatives?", answer: "You can follow our blog, subscribe to our newsletter, or connect with us on social media to stay informed." }
];

const insertDefaultFAQs = async () => {
    try {
        for (const faq of defaultFAQs) {
            const existingFAQ = await FAQ.findOne({ question: faq.question });
            if (!existingFAQ) {
                await FAQ.create(faq);
                console.log(`Inserted FAQ: ${faq.question}`);
            }
        }
    } catch (error) {
        console.error("Error inserting default FAQs:", error);
    }
};

// Ensure the FAQs are inserted into the database when the model is first loaded
insertDefaultFAQs();

module.exports = FAQ;


