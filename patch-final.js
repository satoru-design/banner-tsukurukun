const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');
const lines = code.split('\n');

const startIndex = lines.findIndex(l => l.includes("{el.type === 'cta' ? ("));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes("</Rnd>"));

const goodBlock = `                                {el.type === 'cta' ? (
                                   <div className={\`no-drag outline-none \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, background: \`linear-gradient(135deg, \${el.textStyle.backgroundColor}, #000)\`, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {el.content}
                                   </div>
                                ) : el.type === 'main' ? (
                                   <div className={\`no-drag flex-grow outline-none \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {renderRichText(el.content, activeDesignSpecs?.color_palette?.accent || '#38bdf8')}
                                   </div>
                                ) : el.type === 'shape' ? (
                                   <div className={el.style} style={el.id === 'bg-plate' ? { background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' } : { backgroundColor: el.textStyle.backgroundColor }} />
                                ) : el.type === 'image' ? (
                                    <img src={el.content} className={el.style} draggable={false} alt="素材" style={{ filter: el.composeMode === 'product-shadow' ? 'drop-shadow(0 30px 40px rgba(0,0,0,0.3)) drop-shadow(0 15px 15px rgba(0,0,0,0.6))' : 'none' }} />
                                ) : (
                                   <div className={\`no-drag outline-none flex-grow \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {el.content}
                                   </div>
                                )}
                             </div>`;

lines.splice(startIndex, endIndex - startIndex, goodBlock);
fs.writeFileSync('src/app/page.tsx', lines.join('\n'));
console.log('Fixed exactly!');
