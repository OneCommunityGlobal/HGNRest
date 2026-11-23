const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();
// Import the Application model
const Application = require('../models/application');

/** Fisher-Yates shuffle of a shallow copy — unbiased and avoids mutating the source array. */
function shuffleCopy(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Sample data generator
const generateSampleData = () => {
  const countries = [
    { code: 'USA', name: 'United States', region: 'North America' },
    { code: 'CAN', name: 'Canada', region: 'North America' },
    { code: 'GBR', name: 'United Kingdom', region: 'Europe' },
    { code: 'DEU', name: 'Germany', region: 'Europe' },
    { code: 'FRA', name: 'France', region: 'Europe' },
    { code: 'IND', name: 'India', region: 'Asia' },
    { code: 'CHN', name: 'China', region: 'Asia' },
    { code: 'JPN', name: 'Japan', region: 'Asia' },
    { code: 'AUS', name: 'Australia', region: 'Oceania' },
    { code: 'BRA', name: 'Brazil', region: 'South America' },
    { code: 'MEX', name: 'Mexico', region: 'North America' },
    { code: 'NGA', name: 'Nigeria', region: 'Africa' },
    { code: 'ZAF', name: 'South Africa', region: 'Africa' },
    { code: 'ESP', name: 'Spain', region: 'Europe' },
    { code: 'ITA', name: 'Italy', region: 'Europe' },
  ];

  const roles = [
    'Software Developer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'DevOps Engineer',
    'UI/UX Designer',
    'Graphic Designer',
    'Product Designer',
    'Project Manager',
    'Product Manager',
    'Program Manager',
    'Data Analyst',
    'Business Analyst',
    'Marketing Specialist',
    'Content Writer',
    'HR Specialist',
    'Sales Representative',
    'Customer Success Manager',
    'QA Engineer',
    'Data Scientist',
    'Machine Learning Engineer',
    'Solutions Architect',
    'Technical Lead',
    'Engineering Manager',
  ];

  const applicationSources = [
    'job_listing',
    'search_results',
    'company_page',
    'social_media',
    'email_campaign',
    'referral_link',
    'advertisement',
    'direct_application',
  ];

  const data = [];
  const now = new Date();

  // Generate data for the past 3 months
  for (let daysAgo = 0; daysAgo < 90; daysAgo += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    // Generate random applications for random countries
    const numCountries = crypto.randomInt(3, 8); // 3-7 countries per day
    const selectedCountries = shuffleCopy(countries).slice(0, numCountries);

    selectedCountries.forEach((country) => {
      const numRoles = crypto.randomInt(1, 4); // 1-3 roles per country per day
      const selectedRoles = shuffleCopy(roles).slice(0, numRoles);

      selectedRoles.forEach((role) => {
        const numberOfApplicants = crypto.randomInt(1, 21); // 1-20 applicants
        const applicationSource =
          applicationSources[crypto.randomInt(0, applicationSources.length)];

        data.push({
          country: country.code,
          countryName: country.name,
          region: country.region,
          role,
          timestamp: date,
          numberOfApplicants,
          jobId: `job-${crypto.randomInt(0, 100)}`,
          jobTitle: `${role.charAt(0).toUpperCase() + role.slice(1)} Position`,
          applicationSource,
        });
      });
    });
  }

  return data;
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB (using same format as db.js)
    const dbUri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName}`;

    if (!process.env.user || !process.env.password || !process.env.cluster || !process.env.dbName) {
      throw new Error('MongoDB connection parameters not found in environment variables');
    }

    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });

    console.log('✅ Connected to MongoDB');

    // Check if data already exists
    const existingCount = await Application.countDocuments();
    console.log(`📊 Existing applications in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Database already has application data.');
      console.log('Would you like to:');
      console.log('1. Keep existing data and add new sample data');
      console.log('2. Clear existing data and add fresh sample data');
      console.log('3. Exit without changes');
      console.log('\nTo clear and reseed, run: node seedApplicationData.js --clear');

      if (!process.argv.includes('--clear')) {
        console.log('📝 Adding sample data alongside existing data...');
      } else {
        console.log('🗑️  Clearing existing data...');
        await Application.deleteMany({});
        console.log('✅ Existing data cleared');
      }
    }

    // Generate and insert sample data
    const sampleData = generateSampleData();
    console.log(`📝 Inserting ${sampleData.length} sample application records...`);

    await Application.insertMany(sampleData);

    console.log('✅ Sample data inserted successfully!');

    // Show summary statistics
    const totalCount = await Application.countDocuments();
    const countries = await Application.distinct('country');
    const roles = await Application.distinct('role');

    console.log('\n📊 Database Summary:');
    console.log(`   Total Applications: ${totalCount}`);
    console.log(`   Countries: ${countries.length} (${countries.join(', ')})`);
    console.log(`   Roles: ${roles.length} (${roles.join(', ')})`);

    // Test a query
    const recentApps = await Application.find().sort({ timestamp: -1 }).limit(5);

    console.log('\n📋 Sample Recent Applications:');
    recentApps.forEach((app, idx) => {
      console.log(
        `   ${idx + 1}. ${app.countryName} (${app.country}) - ${app.role} - ${app.numberOfApplicants} applicants`,
      );
    });

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n🚀 You can now test the API endpoints:');
    console.log('   GET /applications?filter=weekly');
    console.log('   GET /applications?filter=monthly');
    console.log('   GET /api/map-analytics/data?filter=weekly');
    console.log('   GET /api/map-analytics/dashboard?filter=monthly');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeding function
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, generateSampleData };
