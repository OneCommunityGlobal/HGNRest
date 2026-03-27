require('dotenv').config();
const { getChatbotReply } = require('./src/services/chatbotService');

async function testChatbot() {
  console.log('🧪 Testing Chatbot Service...\n');

  try {
    // Test 1: Simple question
    console.log('📝 Test 1: Simple question');
    const result1 = await getChatbotReply('What is this project about?', []);
    console.log('Response:', result1);
    console.log(`\n${'='.repeat(50)}\n`);

    // Test 2: Question with history
    console.log('📝 Test 2: Question with history');
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! How can I help you today?' },
    ];
    const result2 = await getChatbotReply('What teams can I join?', history);
    console.log('Response:', result2);
    console.log(`\n${'='.repeat(50)}\n`);

    // Test 3: Empty question
    console.log('📝 Test 3: Empty question');
    const result3 = await getChatbotReply('', []);
    console.log('Response:', result3);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testChatbot();
