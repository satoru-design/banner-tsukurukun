const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Text Properties Enhancement
// main-text
content = content.replace(
  `style: "p-4 leading-tight inline-block resize-none w-full h-full overflow-hidden focus:outline-none bg-transparent"`,
  `style: "p-4 leading-tight inline-block resize-none w-full h-full overflow-hidden break-all whitespace-pre-wrap focus:outline-none bg-transparent"`
);
content = content.replace(
  `textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#ffffff", backgroundColor: "transparent", fontSize: 60, fontWeight: "900", textAlign: isCenter ? "center" : "left" }`,
  `textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#ffffff", backgroundColor: "transparent", fontSize: 50, fontWeight: "900", textAlign: isCenter ? "center" : "left" }`
);

// sub-text
content = content.replace(
  `style: "px-6 py-3 rounded-full shadow-xl whitespace-pre-wrap resize-none w-full h-full overflow-hidden flex items-center justify-center focus:outline-none bg-transparent"`,
  `style: "px-6 py-3 rounded-full shadow-xl break-all whitespace-pre-wrap resize-none w-full h-full overflow-hidden flex items-center justify-center focus:outline-none bg-transparent"`
);
content = content.replace(
  `textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#000000", backgroundColor: "#ffffff", fontSize: 30, fontWeight: "700", textAlign: "center" }`,
  `textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#000000", backgroundColor: "#ffffff", fontSize: 24, fontWeight: "700", textAlign: "center" }`
);

// 2. Master Prompt Enhancement for Layout Direction mapping
const oldLeftPrompt = `if (layoutStyle === 'left') masterPrompt += \`, leave an extremely massive, clean empty negative space on the entire left side for text overlay. Position the main subject strictly on the right side.\`;`;
const newLeftPrompt = `if (layoutStyle === 'left') masterPrompt += \`, Muted studio background. Leave the ENTIRE LEFT HALF completely solid blank and empty for overlay. Strictly place the main subject ONLY on the FAR RIGHT edge.\`;`;
content = content.replace(oldLeftPrompt, newLeftPrompt);

const oldRightPrompt = `if (layoutStyle === 'right') masterPrompt += \`, leave an extremely massive, clean empty negative space on the entire right side for text overlay. Position the main subject strictly on the left side.\`;`;
const newRightPrompt = `if (layoutStyle === 'right') masterPrompt += \`, Muted studio background. Leave the ENTIRE RIGHT HALF completely solid blank and empty for overlay. Strictly place the main subject ONLY on the FAR LEFT edge.\`;`;
content = content.replace(oldRightPrompt, newRightPrompt);

const oldCenterPrompt = `if (layoutStyle === 'center') masterPrompt += \`, leave a clean negative space in the dead center. Edge framing, subjects on the borders.\`;`;
const newCenterPrompt = `if (layoutStyle === 'center') masterPrompt += \`, leave a massive clean empty negative space in the dead center. Subject framing the outer borders.\`;`;
content = content.replace(oldCenterPrompt, newCenterPrompt);

// 3. Coordinate System (tx, tw) Overhaul in enterEditor
const oldAutoSnap = `    // Auto-snap positioning based on layout strategy
    const tx = isLeft ? canvasSize.w * 0.05 : isCenter ? canvasSize.w * 0.1 : canvasSize.w * 0.45;
    const tw = isCenter ? canvasSize.w * 0.8 : (canvasSize.w * 0.5 - 20);`;
const newAutoSnap = `    // Absolute strict layout coordinates to prevent cutoff
    let tx = canvasSize.w * 0.05;
    let tw = canvasSize.w * 0.45;
    if (isLeft) { // Text Left, Subject Right
      tx = canvasSize.w * 0.05;
      tw = canvasSize.w * 0.45; 
    } else if (isCenter) {
      tx = canvasSize.w * 0.1;
      tw = canvasSize.w * 0.8;
    } else { // Text Right, Subject Left
      tx = canvasSize.w * 0.50; // Start at midpoint
      tw = canvasSize.w * 0.45; // Fit safely within right side
    }`;
content = content.replace(oldAutoSnap, newAutoSnap);

// 4. Product Image shadow fix
const oldShadow = `drop-shadow(0 20px 25px rgba(0,0,0,0.6)) drop-shadow(0 4px 6px rgba(0,0,0,0.9))`;
const newShadow = `drop-shadow(0 30px 40px rgba(0,0,0,0.3)) drop-shadow(0 15px 15px rgba(0,0,0,0.6))`;
content = content.replace(oldShadow, newShadow);

// Additional Product Image Pos Adjustment (isLeft -> text is left, subject is right)
// So image should be on the subject side or text side? Ad design usually anchors product slightly off-center.
// We will let the product stay at the text side but anchored to bottom.
content = content.replace(
  `defaultPos: { x: (isLeft ? canvasSize.w - 350 : 50) + (i * 30), y: canvasSize.h*0.4 + (i * 30), w: 300, h: 300 }`,
  `defaultPos: { x: (isLeft ? canvasSize.w * 0.05 : canvasSize.w * 0.55) + (i * 80), y: canvasSize.h * 0.6, w: 250, h: 300 }`
);

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log('Layout logic completely overhauled!');
