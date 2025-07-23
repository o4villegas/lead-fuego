// Direct Component Testing - No Server Required
// Tests individual services and components directly

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
config({ path: join(__dirname, '../config/test.env') });

interface ComponentTestResult {
  component: string;
  test: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

class DirectComponentTest {
  private results: ComponentTestResult[] = [];

  async runAllTests(): Promise<{ passed: number; failed: number; results: ComponentTestResult[] }> {
    console.log('🔬 Direct Component Testing (No Server Required)\n');

    // Test crypto utilities
    await this.testCryptoUtilities();
    
    // Test JWT operations (mock environment)
    await this.testJWTOperations();
    
    // Test database service (requires D1 connection)
    await this.testDatabaseService();

    // Test validation schemas
    await this.testValidationSchemas();

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    this.displayResults();
    return { passed, failed, results: this.results };
  }

  private async runTest(
    component: string,
    test: string,
    testFunction: () => Promise<any>
  ): Promise<ComponentTestResult> {
    const startTime = Date.now();
    const result: ComponentTestResult = {
      component,
      test,
      success: false,
      duration: 0
    };

    try {
      result.data = await testFunction();
      result.success = true;
      result.duration = Date.now() - startTime;
      
      console.log(`✅ ${component}: ${test} (${result.duration}ms)`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.duration = Date.now() - startTime;
      
      console.log(`❌ ${component}: ${test} - ${result.error} (${result.duration}ms)`);
    }

    this.results.push(result);
    return result;
  }

  private async testCryptoUtilities() {
    console.log('🔐 Testing Crypto Utilities...\n');

    await this.runTest('Crypto', 'Generate ID', async () => {
      // Test our crypto utility function
      const { generateId } = await import('../../src/worker/utils/crypto.js');
      const id = await generateId();
      
      if (!id || id.length < 10) {
        throw new Error('Generated ID too short or empty');
      }
      
      return { id, length: id.length };
    });

    await this.runTest('Crypto', 'Multiple ID uniqueness', async () => {
      const { generateId } = await import('../../src/worker/utils/crypto.js');
      const ids = await Promise.all([
        generateId(),
        generateId(),
        generateId()
      ]);
      
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        throw new Error('Generated IDs are not unique');
      }
      
      return { ids, uniqueCount: uniqueIds.size };
    });
  }

  private async testJWTOperations() {
    console.log('\n🎫 Testing JWT Operations...\n');

    await this.runTest('JWT', 'SignJWT import', async () => {
      const { SignJWT, jwtVerify } = await import('jose');
      return { SignJWT: !!SignJWT, jwtVerify: !!jwtVerify };
    });

    await this.runTest('JWT', 'Token generation', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode('test-secret-key-for-testing');
      
      const jwt = await new SignJWT({ userId: 'test123', email: 'test@example.com' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
      
      if (!jwt || jwt.split('.').length !== 3) {
        throw new Error('Invalid JWT format generated');
      }
      
      return { jwt: jwt.substring(0, 20) + '...', parts: jwt.split('.').length };
    });
  }

  private async testDatabaseService() {
    console.log('\n🗄️  Testing Database Service...\n');

    await this.runTest('Database', 'Service instantiation', async () => {
      // Mock D1Database for testing
      const mockDB = {
        prepare: (query: string) => ({
          bind: (...params: any[]) => ({
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true })
          })
        })
      };

      const { DatabaseService } = await import('../../src/worker/services/database.js');
      const db = new DatabaseService(mockDB as any);
      
      return { instantiated: true, type: typeof db };
    });

    await this.runTest('Database', 'User creation structure', async () => {
      const mockDB = {
        prepare: (query: string) => {
          // Validate the query structure
          if (!query.includes('INSERT INTO users')) {
            throw new Error('Invalid user creation query');
          }
          return {
            bind: (...params: any[]) => {
              if (params.length !== 11) {
                throw new Error(`Expected 11 parameters, got ${params.length}`);
              }
              return {
                run: async () => ({ success: true })
              };
            }
          };
        }
      };

      const { DatabaseService } = await import('../../src/worker/services/database.js');
      const db = new DatabaseService(mockDB as any);
      
      const testUser = {
        id: 'test123',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        company: 'Test Corp',
        subscription_tier: 'free',
        onboarding_completed: false,
        is_active: true,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      
      await db.createUser(testUser);
      return { validated: true };
    });
  }

  private async testValidationSchemas() {
    console.log('\n✅ Testing Validation Schemas...\n');

    await this.runTest('Validation', 'Zod schema imports', async () => {
      const { z } = await import('zod');
      
      // Test basic schema creation
      const testSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(0).max(120)
      });
      
      const validData = { name: 'Test', email: 'test@example.com', age: 30 };
      const result = testSchema.parse(validData);
      
      return { validated: true, result };
    });

    await this.runTest('Validation', 'Campaign validation schema', async () => {
      const { z } = await import('zod');
      
      // Replicate our campaign validation schema
      const campaignSchema = z.object({
        name: z.string().min(1).max(255),
        objective: z.string(),
        budget: z.number().min(1),
        targetAudience: z.object({
          ageMin: z.number().min(13).max(65).optional(),
          ageMax: z.number().min(13).max(65).optional(),
          genders: z.array(z.string()).optional(),
          locations: z.array(z.string()).optional()
        }),
        creativeGuidance: z.object({
          brandVoice: z.string().optional(),
          keyMessage: z.string().optional(),
          visualStyle: z.string().optional()
        }).optional()
      });
      
      const validCampaign = {
        name: 'Test Campaign',
        objective: 'LEAD_GENERATION',
        budget: 50.00,
        targetAudience: {
          ageMin: 25,
          ageMax: 45,
          locations: ['US']
        }
      };
      
      const result = campaignSchema.parse(validCampaign);
      return { validated: true, result };
    });
  }

  private displayResults() {
    console.log('\n📊 DIRECT COMPONENT TEST RESULTS');
    console.log('=================================\n');

    const byComponent = this.results.reduce((acc, result) => {
      if (!acc[result.component]) {
        acc[result.component] = { passed: 0, failed: 0, tests: [] };
      }
      
      if (result.success) {
        acc[result.component].passed++;
      } else {
        acc[result.component].failed++;
      }
      
      acc[result.component].tests.push(result);
      return acc;
    }, {} as Record<string, { passed: number; failed: number; tests: ComponentTestResult[] }>);

    Object.entries(byComponent).forEach(([component, stats]) => {
      const status = stats.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${component}: ${stats.passed}/${stats.passed + stats.failed} passed`);
      
      stats.tests.forEach(test => {
        const testStatus = test.success ? '  ✅' : '  ❌';
        console.log(`${testStatus} ${test.test}`);
        if (test.error) {
          console.log(`     Error: ${test.error}`);
        }
      });
      console.log('');
    });

    const totalPassed = this.results.filter(r => r.success).length;
    const totalFailed = this.results.filter(r => !r.success).length;
    const overallStatus = totalFailed === 0 ? '✅' : '❌';
    
    console.log(`${overallStatus} Overall: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
  }
}

// Self-executing test when run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const test = new DirectComponentTest();
  test.runAllTests()
    .then(results => {
      const success = results.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Direct component test execution failed:', error);
      process.exit(1);
    });
}

export { DirectComponentTest };