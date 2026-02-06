const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const seedDir = __dirname; // assuming this file lives in src/seeders

const scripts = [
  'seedBadge.js',
  'seedSubject.js',
  'seedProject.js',
  'seedAtom.js',
  'seedUserProfile.js',
  'seedWbs.js',
  'seedApplicationAccess.js',
  'seedTeams.js',
  'seedTask.js',
  'seedLessonPlan.js',
  'seedProgress.js',
];

function runScript(file) {
  const scriptPath = path.join(seedDir, file);
  return new Promise((resolve, reject) => {
    console.log(`\n--- Running ${file} ---`);
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });

    child.on('error', (err) => reject(new Error(`${file} failed to start: ${err.message}`)));

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${file} completed`);
        resolve();
      } else {
        reject(new Error(`${file} exited with code ${code}`));
      }
    });
  });
}

(async () => {
  try {
    // Run each script sequentially to handle dependencies
    for (const script of scripts) {
      await runScript(script);
    }

    console.log('\n🎉 All seed scripts completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    process.exit(1);
  }
})();
