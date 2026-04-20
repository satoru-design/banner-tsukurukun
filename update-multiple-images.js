const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. State changes
content = content.replace(
  /const \[productImageBase64, setProductImageBase64\] = useState<string\|null>\(null\);/g,
  `const [productImagesBase64, setProductImagesBase64] = useState<string[]>([]);`
);
content = content.replace(
  /const \[logoBase64, setLogoBase64\] = useState<string\|null>\(null\);/g,
  `const [logosBase64, setLogosBase64] = useState<string[]>([]);`
);

// 2. handleFileUploadForConditions
const originalHandleUpload = `  const handleFileUploadForConditions = async (e: React.ChangeEvent<HTMLInputElement>, setter: (s:string)=>void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await readAsBase64(file);
    setter(base64);
  };`;
const newHandleUpload = `  const handleFileUploadForConditions = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const promises = files.map(f => readAsBase64(f));
    const base64s = await Promise.all(promises);
    setter(prev => [...prev, ...base64s]);
  };`;
content = content.replace(originalHandleUpload, newHandleUpload);

// 3. UI logic changes
// Product
content = content.replace(
  /onChange=\{\(e\)=>handleFileUploadForConditions\(e, setProductImageBase64\)}/g,
  `multiple onChange={(e)=>handleFileUploadForConditions(e, setProductImagesBase64)}`
);
content = content.replace(
  /\{productImageBase64 && <span className=\"text-teal-400 text-xs text-bold\">✅ 添付済<\/span>\}/g,
  `{productImagesBase64.length > 0 && <span className="text-teal-400 text-xs font-bold">✅ {productImagesBase64.length}枚添付済</span>}`
);
// Logo
content = content.replace(
  /onChange=\{\(e\)=>handleFileUploadForConditions\(e, setLogoBase64\)}/g,
  `multiple onChange={(e)=>handleFileUploadForConditions(e, setLogosBase64)}`
);
content = content.replace(
  /\{logoBase64 && <span className=\"text-teal-400 text-xs text-bold\">✅ 添付済<\/span>\}/g,
  `{logosBase64.length > 0 && <span className="text-teal-400 text-xs font-bold">✅ {logosBase64.length}枚添付済</span>}`
);

// 4. enterEditor mapping
const originalLogoBlock = `    if (hasLogo === 'yes' && logoBase64) {
      initialElements.push({
        id: 'logo-img', type: 'image', content: logoBase64, style: "w-full h-full object-contain pointer-events-none",
        textStyle: { color:"", backgroundColor:"", fontSize:0, fontWeight:"", textAlign:"center" },
        defaultPos: { x: canvasSize.w - 220, y: 20, w: 200, h: 100 }
      });
    }`;
const newLogoBlock = `    if (hasLogo === 'yes' && logosBase64.length > 0) {
      logosBase64.forEach((b64, i) => {
        initialElements.push({
          id: \`logo-img-\${i}\`, type: 'image', content: b64, style: "w-full h-full object-contain pointer-events-none",
          textStyle: { color:"", backgroundColor:"", fontSize:0, fontWeight:"", textAlign:"center" },
          defaultPos: { x: canvasSize.w - 220 - (i * 20), y: 20 + (i * 20), w: 200, h: 100 }
        });
      });
    }`;
content = content.replace(originalLogoBlock, newLogoBlock);

const originalProductBlock = `    if (hasProductImage === 'yes' && productImageBase64) {
      initialElements.push({
        id: 'product-img', type: 'image', content: productImageBase64, style: "w-full h-full object-contain pointer-events-none", composeMode: "product-shadow",
        textStyle: { color:"", backgroundColor:"", fontSize:0, fontWeight:"", textAlign:"center" },
        defaultPos: { x: isCenter ? canvasSize.w*0.25 : (isLeft ? canvasSize.w*0.55 : 50), y: canvasSize.h*0.2, w: canvasSize.w*0.4, h: canvasSize.h*0.6 }
      });
    }`;
const newProductBlock = `    if (hasProductImage === 'yes' && productImagesBase64.length > 0) {
      productImagesBase64.forEach((b64, i) => {
        initialElements.push({
          id: \`product-img-\${i}\`, type: 'image', content: b64, style: "w-full h-full object-contain pointer-events-none", composeMode: "product-shadow",
          textStyle: { color:"", backgroundColor:"", fontSize:0, fontWeight:"", textAlign:"center" },
          defaultPos: { x: (isCenter ? canvasSize.w*0.25 : (isLeft ? canvasSize.w*0.55 : 50)) + (i * 40), y: canvasSize.h*0.2 + (i * 40), w: canvasSize.w*0.4, h: canvasSize.h*0.6 }
        });
      });
    }`;
content = content.replace(originalProductBlock, newProductBlock);

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("update complete");
