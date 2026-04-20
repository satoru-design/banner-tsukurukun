import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const models = ['gemini-1.5-pro-latest', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  for (const m of models) {
    try {
        console.log("testing", m);
        await ai.models.generateContent({ model: m, contents: ['Hello'] });
        console.log("Success:", m);
    } catch(e: any) {
        console.error("Failed:", m, e.message);
    }
  }
}
run();
