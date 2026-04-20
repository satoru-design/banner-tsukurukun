import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    const models = await anthropic.models.list();
    console.log(JSON.stringify(models.data, null, 2));
  } catch (err: any) {
    if (err.status === 404) {
       console.log("Model endpoint not found. Trying another way or maybe API version is old.");
    }
    console.error("Error:", err.message);
  }
}

main();
