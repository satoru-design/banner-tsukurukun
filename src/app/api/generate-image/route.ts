import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Call Flux.1 dev or schnell via Replicate
    // "black-forest-labs/flux-schnell" is highly optimized and fast.
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_outputs: 1,
          output_format: "webp",
          output_quality: 90
        }
      }
    );

    // Replicate returns an array of image URLs
    const imageUrl = Array.isArray(output) ? output[0] : output;

    return NextResponse.json({ imageUrl });

  } catch (error: any) {
    console.error('API Error (generate-image):', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
