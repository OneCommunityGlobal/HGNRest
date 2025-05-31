const express = require('express');
const app = express();

// Body parser middleware
app.use(express.json());

// Routes
const jobApplicantsRoutes = require('./routes/jobapplicantRouter');
app.use('/api', jobApplicantsRoutes);

module.exports = app; // ✅ Export app only
