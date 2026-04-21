require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

async function testModel(modelId) {
  try {
    const message = await anthropic.messages.create({
      model: modelId,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hello' }]
    });
    console.log(`[SUCCESS] ${modelId}`);
  } catch (e) {
    console.log(`[ERROR] ${modelId}: ${e.message}`);
  }
}

async function run() {
  const models = [
    'claude-sonnet-4-6',
    'claude-4-6-sonnet',
    'claude-4-sonnet',
    'claude-4-opus'
  ];
  
  for (const m of models) {
    await testModel(m);
  }
}

run();
