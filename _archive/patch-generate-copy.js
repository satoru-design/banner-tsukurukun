const fs = require('fs');

let code = fs.readFileSync('src/app/api/generate-copy/route.ts', 'utf-8');

// 1. Remove Jina logic and expect lpText in payload
const oldDataExtraction = `    const { url, productName, target, competitorInsights } = await req.json();

    if (!url && !productName && !competitorInsights) {
      return NextResponse.json({ error: 'URL or Product Name or Image Upload is required' }, { status: 400 });
    }

    let lpText = '';
    if (url) {
       // Use Jina Reader to get clean markdown from LP
       try {
         const jinaRes = await fetch(\`https://r.jina.ai/\${url}\`, {
           headers: {
             'Accept': 'text/plain',
           }
         });
         if (jinaRes.ok) {
           lpText = await jinaRes.text();
           lpText = lpText.slice(0, 15000); // Limit context size
         }
       } catch (e: any) {
         console.warn("Jina reader failed:", e);
       }
    }`;

const newDataExtraction = `    const { productName, target, competitorInsights, lpText } = await req.json();

    if (!productName && !competitorInsights && !lpText) {
      return NextResponse.json({ error: 'Product Name or Insights or LP Text is required' }, { status: 400 });
    }`;

code = code.replace(oldDataExtraction, newDataExtraction);

// 2. Modify system prompt to strongly enforce worldview in image_gen_prompt
const oldImageGenInstruction = `"image_gen_prompt": "高画質な背景画像生成用の詳細な英語プロンプト。※テキストは含めず、ネガティブスペースを意識した構図を指示すること"`;
const newImageGenInstruction = `"image_gen_prompt": "高画質な背景画像生成用の詳細な英語プロンプト。※抽出されたLPの世界観（和風、モダニズム、メディカル等）や得られたインサイトのトーンを色濃く反映させ、ネガティブスペースを意識した構図を指示すること。テキストは含めない"`;

code = code.replace(oldImageGenInstruction, newImageGenInstruction);

fs.writeFileSync('src/app/api/generate-copy/route.ts', code);
console.log('Patched generate-copy!');
