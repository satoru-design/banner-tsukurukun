import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Call Google Gemini Imagen 3 (Nano Banana) API
    // gemini-3.1-flash-image-preview or gemini-3-pro-image-preview
    // Using flash for speed/efficiency as mentioned in docs
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
    });

    let base64Image = null;
    
    // Parse the response which contains inlineData for the generated image
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
       for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
             base64Image = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
             break;
          }
       }
    }

    if (!base64Image) {
      throw new Error("No image data returned from Gemini Imagen API.");
    }

    return NextResponse.json({ imageUrl: base64Image });

  } catch (error: any) {
    console.error('API Error (generate-image):', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
