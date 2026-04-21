const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Replace property definitions for Rnd default compatibility
content = content.replace(/w: number \| string, h: number \| string/g, "width: number | string, height: number | string");
content = content.replace(/w: canvasSize.w\*0\.05/g, "width: canvasSize.w*0.9"); // Leftover from previous
content = content.replace(/w: (canvasSize.w[\*\/\s\.\-0-9a-zA-Z\(\)]+), h: ([0-9]+)/g, "width: $1, height: $2");
content = content.replace(/w: ([0-9]+), h: ([0-9]+)/g, "width: $1, height: $2");
content = content.replace(/w: /g, "width: ");
content = content.replace(/h: /g, "height: ");

// Also fix the element assignment where we had w: and h:. Let's just fix it globally via regex for defaultPos
// A safer way is to just map it dynamically in JSX since changing type properties throughout code can cause cascading issues if there are other uses.
// Let's just fix it inside the map: <Rnd default={{ x: el.defaultPos.x, y: el.defaultPos.y, width: el.defaultPos.width || el.defaultPos.w, height: el.defaultPos.height || el.defaultPos.h }} ...>

// Wait, I can just fix the JSX directly
content = fs.readFileSync('src/app/page.tsx', 'utf-8');
content = content.replace(/default=\{el\.defaultPos\}/g, "default={{ x: el.defaultPos.x, y: el.defaultPos.y, width: (el.defaultPos as any).w || (el.defaultPos as any).width, height: (el.defaultPos as any).h || (el.defaultPos as any).height }}");

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("Fixed Rnd types");
