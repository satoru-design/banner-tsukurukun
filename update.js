const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Replace CTA style
content = content.replace(/\{el\.type === 'cta' \? \([\s\S]*?<input className=\{`no-drag outline-none \$\{el\.style\}`\} style=\{\{([^}]*)\}\} value=\{el\.content\} onChange=\{e => updateText\(el\.id, e\.target\.value\)\} \/>/g,
  `{el.type === 'cta' ? (
                                <input className={\`no-drag outline-none \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }} value={el.content} onChange={e => updateText(el.id, e.target.value)} />`
);

// Replace Image drop shadow logic
content = content.replace(/\) : el\.type === 'image' \? \([\s\S]*?<img src=\{el\.content\} className=\{el\.style\} draggable=\{false\} alt="素材" \/>/g,
  `) : el.type === 'image' ? (
                                <img src={el.content} className={el.style} draggable={false} alt="素材" style={{ filter: el.composeMode === 'product-shadow' ? 'drop-shadow(0 20px 25px rgba(0,0,0,0.6)) drop-shadow(0 4px 6px rgba(0,0,0,0.9))' : 'none' }} />`
);

// Replace Textarea inline style
content = content.replace(/\) : \([\s\S]*?<textarea className=\{`no-drag outline-none flex-grow \$\{el\.style\}`\} style=\{\{([^}]*)\}\} value=\{el\.content\} onChange=\{e => updateText\(el\.id, e\.target\.value\)\} \/>/g,
  `) : (
                                <textarea className={\`no-drag outline-none flex-grow \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }} value={el.content} onChange={e => updateText(el.id, e.target.value)} />`
);

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("Updated styles!");
