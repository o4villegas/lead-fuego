// Local development test runner
// Run with: npm run test:auth

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let wranglerProcess: any = null;

async function startDevServer(): Promise<void> {
  console.log('🚀 Starting Wrangler dev server...');
  
  return new Promise((resolve, reject) => {
    wranglerProcess = spawn('npx', ['wrangler', 'dev', '--port', '8787'], {
      cwd: join(__dirname, '../..'),
      stdio: 'pipe',
      shell: true
    });

    let serverReady = false;

    wranglerProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('   ', output.trim());
      
      if (output.includes('Ready on') && !serverReady) {
        serverReady = true;
        setTimeout(() => resolve(), 2000); // Give it 2 seconds to fully start
      }
    });

    wranglerProcess.stderr.on('data', (data: Buffer) => {
      console.error('   Error:', data.toString());
    });

    wranglerProcess.on('error', (error: Error) => {
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

async function runTests(): Promise<void> {
  console.log('🧪 Running authentication tests...\n');
  
  return new Promise((resolve, reject) => {
    const testProcess = spawn('npx', ['tsx', join(__dirname, 'auth-api.test.ts')], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        TEST_API_URL: 'http://localhost:8787'
      }
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function cleanup() {
  if (wranglerProcess) {
    console.log('\n🧹 Shutting down dev server...');
    wranglerProcess.kill();
  }
}

async function main() {
  try {
    await startDevServer();
    await runTests();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test run failed:', error);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

main();