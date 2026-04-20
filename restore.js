const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\strkk\\.gemini\\antigravity\\brain\\dede72ac-218a-4df9-897e-6d9b733648d9\\.system_generated\\logs\\overview.txt';
if (!fs.existsSync(logPath)) {
  console.log("Log not found.");
  process.exit();
}

const lines = fs.readFileSync(logPath, 'utf-8').split('\n');
const reconstructed = Array(800).fill('');

let recording = false;
for (const line of lines) {
  // Look for lines that look like "123: text"
  const match = line.match(/^(\d+):\s(.*)/);
  if (match) {
    const lineNo = parseInt(match[1]);
    const content = match[2];
    reconstructed[lineNo] = content;
  }
}

let result = '';
for (let i = 1; i <= 752; i++) {
  result += (reconstructed[i] || '') + '\n';
}

fs.writeFileSync('src/app/page.tsx', result);
console.log('Restored tentatively! Check the file.');
