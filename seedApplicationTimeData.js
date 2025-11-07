/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const ApplicationTime = require('./dist/models/applicationTime');

// Connect to MongoDB using the same pattern as the application
const connectDB = async () => {
  try {
    // Check for required environment variables
    if (!process.env.user || !process.env.password || !process.env.cluster || !process.env.dbName) {
      throw new Error('Missing required MongoDB environment variables: user, password, cluster, dbName');
    }

    const uri = `mongodb+srv://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${process.env.appName || 'HGNProdDB'}`;
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Generate random time between min and max seconds
const randomTime = (minSeconds, maxSeconds) => {
  return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
};

// Generate random date within last N days
const randomDateWithinDays = (daysAgo = 7) => {
  const now = new Date();
  const daysAgoMs = daysAgo * 24 * 60 * 60 * 1000;
  const randomMs = Math.random() * daysAgoMs;
  return new Date(now.getTime() - randomMs);
};

// Seed test data
const seedData = async () => {
  try {
    console.log('🗑️  Clearing existing test data...');
    await ApplicationTime.deleteMany({});
    console.log('✅ Cleared existing data');

    const roles = [
      'Software Engineer',
      'Product Designer',
      'Data Scientist',
      'Marketing Manager',
      'Sales Representative',
      'UX Designer',
      'DevOps Engineer',
      'Project Manager'
    ];

    const testData = [];
    const now = new Date();

    console.log('📊 Generating test data...');

    // Generate data for each role
    roles.forEach((role, roleIndex) => {
      // Generate 15-30 applications per role
      const numApplications = 15 + Math.floor(Math.random() * 16);

      for (let i = 0; i < numApplications; i++) {
        // Random date within last 7 days
        const appliedAt = randomDateWithinDays(7);
        
        // Generate realistic application times
        // Most applications take 2-15 minutes, some take 15-45 minutes
        let timeTaken;
        if (Math.random() > 0.1) {
          // 90% of applications take 2-15 minutes
          timeTaken = randomTime(120, 900); // 2-15 minutes
        } else {
          // 10% take 15-45 minutes
          timeTaken = randomTime(900, 2700); // 15-45 minutes
        }

        // Some outliers (> 1 hour) - but these will be filtered out
        if (Math.random() > 0.95) {
          timeTaken = randomTime(3600, 7200); // 1-2 hours (outliers)
        }

        const clickedAt = new Date(appliedAt.getTime() - timeTaken * 1000);

        testData.push({
          role,
          userId: `user_${roleIndex}_${i}`,
          jobId: `job_${roleIndex}_${i}`,
          jobTitle: `${role} Position ${i + 1}`,
          clickedAt,
          appliedAt,
          timeTaken,
          sessionId: `session_${roleIndex}_${i}_${Date.now()}`,
          deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          location: {
            country: 'USA',
            state: ['CA', 'NY', 'TX', 'FL', 'IL'][Math.floor(Math.random() * 5)]
          },
          isOutlier: timeTaken > 3600, // Mark outliers (> 1 hour)
          createdAt: appliedAt,
          updatedAt: appliedAt
        });
      }
    });

    console.log(`📝 Inserting ${testData.length} application time records...`);
    await ApplicationTime.insertMany(testData);
    
    // Verify insertion
    const totalRecords = await ApplicationTime.countDocuments();
    const nonOutliers = await ApplicationTime.countDocuments({ isOutlier: false });
    const outliers = await ApplicationTime.countDocuments({ isOutlier: true });
    const rolesCount = await ApplicationTime.distinct('role');

    console.log('\n✅ Test data seeded successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Non-outliers: ${nonOutliers} (will be shown in chart)`);
    console.log(`   Outliers: ${outliers} (filtered out)`);
    console.log(`   Unique roles: ${rolesCount.length}`);
    console.log(`   Roles: ${rolesCount.join(', ')}`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Refresh your frontend');
    console.log('   2. The chart should now display data');
    console.log('   3. Try filtering by dates and roles\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
};

// Main execution
const run = async () => {
  try {
    await connectDB();
    await seedData();
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

run();

