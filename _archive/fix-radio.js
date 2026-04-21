const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// The radio groups have this exact class:
// "flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700"
// We will replace it with:
// "flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white"

content = content.replace(/className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700"/g,
  'className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white"'
);

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("Radio buttons text-white fixed!");
