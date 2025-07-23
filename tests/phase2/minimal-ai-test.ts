// Minimal Workers AI Test
// Tests the actual Workers AI integration without full server

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = dirname(__dirname);

// Load test environment
config({ path: join(testDir, 'config/test.env') });

class MinimalAITest {
  async testWorkersAI() {
    console.log('🤖 Testing Workers AI Integration...\n');

    try {
      // Try to import our Workers AI service
      const { WorkersAIService } = await import('../../src/worker/services/workers-ai.js');
      console.log('✅ WorkersAIService imported successfully');

      // Create mock environment
      const mockEnv = {
        AI: {
          run: async (model: string, options: any) => {
            console.log(`📡 Mock AI call to ${model}`);
            console.log(`   Prompt: ${JSON.stringify(options.messages[1].content).substring(0, 100)}...`);
            
            // Return mock response that matches Workers AI format
            return {
              response: "Transform your business with cutting-edge technology. Get started today!"
            };
          }
        }
      };

      const aiService = new WorkersAIService(mockEnv as any);
      console.log('✅ WorkersAIService instantiated');

      // Test ad copy generation
      console.log('\n🎯 Testing ad copy generation...');
      const adCopyResults = await aiService.generateAdCopy(
        'LEAD_GENERATION',
        { ageMin: 25, ageMax: 45, interests: ['technology'] },
        { brandVoice: 'Professional', keyMessage: 'Transform your business' },
        2
      );

      console.log(`✅ Generated ${adCopyResults.length} ad copy variations`);
      adCopyResults.forEach((result, index) => {
        console.log(`   ${index + 1}. "${result.text}" (${result.characterCount} chars, valid: ${result.valid})`);
      });

      // Test headline generation
      console.log('\n📝 Testing headline generation...');
      const headlines = await aiService.generateHeadlines(
        'LEAD_GENERATION',
        'Transform your business with cutting-edge technology.',
        { keyMessage: 'Transform your business' }
      );

      console.log(`✅ Generated ${headlines.length} headlines`);
      headlines.forEach((headline, index) => {
        console.log(`   ${index + 1}. "${headline.text}" (${headline.characterCount} chars, valid: ${headline.valid})`);
      });

      return {
        success: true,
        adCopyCount: adCopyResults.length,
        headlineCount: headlines.length,
        validAdCopy: adCopyResults.filter(r => r.valid).length,
        validHeadlines: headlines.filter(h => h.valid).length
      };

    } catch (error) {
      console.error('❌ Workers AI test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testContentValidation() {
    console.log('\n📏 Testing content validation...\n');

    try {
      const { WorkersAIService } = await import('../../src/worker/services/workers-ai.js');
      
      // Create mock environment
      const mockEnv = { AI: { run: async () => ({ response: '' }) } };
      const aiService = new WorkersAIService(mockEnv as any);

      // Test validation function
      const testCases = [
        { type: 'ad_copy', text: 'Short ad copy', length: 15, shouldPass: true },
        { type: 'ad_copy', text: 'A'.repeat(130), length: 130, shouldPass: false },
        { type: 'headline', text: 'Great Headline', length: 14, shouldPass: true },
        { type: 'headline', text: 'A'.repeat(50), length: 50, shouldPass: false },
        { type: 'sms', text: 'Hi John, thanks for your interest!', length: 34, shouldPass: true },
        { type: 'sms', text: 'A'.repeat(170), length: 170, shouldPass: false }
      ];

      let passed = 0;
      let failed = 0;

      for (const testCase of testCases) {
        const content = {
          text: testCase.text,
          characterCount: testCase.length,
          model: 'test',
          prompt: 'test',
          valid: true
        };

        const isValid = aiService.validateContent(content, testCase.type as any);
        const expectedResult = testCase.shouldPass;

        if (isValid === expectedResult) {
          console.log(`✅ ${testCase.type} validation (${testCase.length} chars): ${isValid ? 'VALID' : 'INVALID'}`);
          passed++;
        } else {
          console.log(`❌ ${testCase.type} validation (${testCase.length} chars): Expected ${expectedResult}, got ${isValid}`);
          failed++;
        }
      }

      return { passed, failed, total: testCases.length };

    } catch (error) {
      console.error('❌ Content validation test failed:', error);
      return { passed: 0, failed: 1, total: 1, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Self-executing test
const test = new MinimalAITest();
Promise.all([
  test.testWorkersAI(),
  test.testContentValidation()
]).then(([aiResult, validationResult]) => {
  console.log('\n🤖 MINIMAL AI TEST RESULTS');
  console.log('===========================\n');
  
  console.log('Workers AI Integration:');
  if (aiResult.success) {
    console.log(`✅ PASSED - Generated ${aiResult.adCopyCount} ad copies, ${aiResult.headlineCount} headlines`);
    console.log(`   Valid content: ${aiResult.validAdCopy}/${aiResult.adCopyCount} ad copies, ${aiResult.validHeadlines}/${aiResult.headlineCount} headlines`);
  } else {
    console.log(`❌ FAILED - ${aiResult.error}`);
  }
  
  console.log('\nContent Validation:');
  if (validationResult.error) {
    console.log(`❌ FAILED - ${validationResult.error}`);
  } else {
    console.log(`${validationResult.failed === 0 ? '✅' : '❌'} ${validationResult.passed}/${validationResult.total} validation tests passed`);
  }

  const overallSuccess = aiResult.success && validationResult.failed === 0;
  console.log(`\n${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(overallSuccess ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});