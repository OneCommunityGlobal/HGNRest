const path = require('path');
const { spawn } = require('child_process');

// Load environment variables from .env before doing anything
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const seedDir = __dirname; // this file lives in src/seeders
const scripts = [
  'seedUserProfile.js',
  'seedLessonPlan.js',
  'seedAtom.js',
  'seedSubject.js',
  'seedTask.js',
  'seedProgress.js',
];

function runScript(file) {
  const scriptPath = path.join(seedDir, file);
  return new Promise((resolve, reject) => {
    console.log(`\n--- Running ${file} ---`);
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });

    child.on('error', (err) => {
      reject(new Error(`${file} failed to start: ${err.message}`));
    });

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
    await Promise.all(scripts.map((s) => runScript(s)));
    console.log('\n🎉 All seed scripts completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  }
})();
