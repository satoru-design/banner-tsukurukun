import 'dotenv/config';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function main() {
  try {
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: "A simple red apple on a desk",
          output_format: "webp",
        }
      }
    );
    const item = Array.isArray(output) ? output[0] : output;
    console.log("item.url exists?", typeof item.url);
    if (typeof item.url === 'function') {
       console.log("url():", item.url());
    }
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}

main();
