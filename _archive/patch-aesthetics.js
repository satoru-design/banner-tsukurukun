const fs = require('fs');

let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Extend sidebar property editor to allow editing ALL text nodes (main, sub, cta)
const oldEditor = `                     {activeEl.type === 'main' && (
                        <div className="mt-4 pt-2 border-t border-teal-500/30">
                           <label className="block text-neutral-400 mb-1 text-xs">テキスト内容 (リッチテキスト編集)</label>
                           <textarea value={activeEl.content} onChange={e => updateText(activeEl.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white resize-y min-h-24 outline-none focus:border-teal-500" placeholder="<mark>強調文字</mark>を入力" />
                        </div>
                     )}`;
const newEditor = `                     {['main', 'sub', 'cta'].includes(activeEl.type) && (
                        <div className="mt-4 pt-2 border-t border-teal-500/30">
                           <label className="block text-neutral-400 mb-1 text-xs">テキスト内容 (リッチテキスト編集)</label>
                           <textarea value={activeEl.content} onChange={e => updateText(activeEl.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white resize-y min-h-24 outline-none focus:border-teal-500" placeholder="<mark>強調文字</mark>等を入力" />
                        </div>
                     )}`;
code = code.replace(oldEditor, newEditor);

// 2. Fix the layout engine elements (enterEditor)
const layoutRegex = /let initialElements: CanvasElement\[\] = \[\];[\s\S]*?setEditorTexts\(initialElements\);/m;
const newLayout = `let initialElements: CanvasElement[] = [];

    // Beautiful Background plate for split-screen
    if (layoutId === 'split-screen') {
       initialElements.push({
         id: 'bg-plate', type: 'shape', content: '', 
         style: "w-full h-full",
         composeMode: "bg-plate",
         textStyle: { color: '', backgroundColor: 'transparent', fontSize: 0, fontWeight: 'normal', textAlign: 'left' },
         defaultPos: { x: 0, y: 0, w: canvasSize.w * 0.65, h: canvasSize.h }
       });
    }

    initialElements.push({ 
        id: 'main-text', type: 'main', content: manualMainCopy, 
        style: "p-4 leading-snug inline-block resize-none w-full h-full overflow-hidden whitespace-pre-wrap focus:outline-none bg-transparent tracking-tighter",
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: mainColor, backgroundColor: "transparent", fontSize: 60, fontWeight: "900", textAlign: layoutId === 'z-pattern' ? "center" : "left" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.1, y: canvasSize.h * 0.15, w: canvasSize.w * 0.8, h: canvasSize.h * 0.4 } : { x: tx, y: canvasSize.h * 0.15, w: tw + 80, h: canvasSize.h*0.4 }
    });

    initialElements.push({ 
        id: 'sub-text', type: 'sub', content: manualSubCopy, 
        style: "px-6 py-4 rounded-xl shadow-2xl break-keep whitespace-pre-wrap resize-none w-full h-full flex items-center justify-center focus:outline-none bg-transparent",
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#000000", backgroundColor: "#ffffff", fontSize: 24, fontWeight: "800", textAlign: "center" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.2, y: canvasSize.h * 0.55, w: canvasSize.w * 0.6, h: 80 } : { x: tx, y: canvasSize.h * 0.6, w: tw + 80, h: 100 }
    });

    if (hasCta === 'yes') {
        initialElements.push({
            id: 'cta-btn', type: 'cta', content: ctaText,
            style: "px-8 py-4 rounded-full shadow-2xl transition-transform hover:scale-105 cursor-pointer flex items-center justify-center outline-none",
            textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "transparent", textShadow: "0px 4px 15px rgba(0,0,0,0.4)", color: "#ffffff", backgroundColor: accentColor, fontSize: 32, fontWeight: "900", textAlign: "center" },
            defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.65, y: canvasSize.h * 0.8, w: 350, h: 90 } : { x: tx, y: canvasSize.h * 0.8, w: tw + 80, h: 90 }
        });
    }

    logosBase64.forEach((logo, i) => {
        initialElements.push({
            id: 'logo-' + i, type: 'image', content: logo, style: "w-full h-full object-contain drop-shadow-md", textStyle: {} as any,
            defaultPos: layoutId === 'z-pattern' ? { x: 40, y: 40, w: 200, h: 60 } : { x: tx, y: 40 + (i*70), w: 150, h: 50 }
        });
    });

    productImagesBase64.forEach((img, i) => {
        initialElements.push({
            id: 'product-' + i, type: 'image', content: img, style: "w-full h-full object-contain", textStyle: {} as any, composeMode: 'product-shadow',
            defaultPos: { x: layoutId === 'split-screen' ? canvasSize.w * 0.45 + (i*80) : canvasSize.w * 0.05 + (i*80), y: canvasSize.h * 0.2, w: canvasSize.w * 0.5, h: canvasSize.h * 0.7 }
        });
    });

    setEditorTexts(initialElements);`;
code = code.replace(layoutRegex, newLayout);

// 3. Fix the Canvas Rendering logic
const renderRegex = /{el.type === 'cta' \? \([\s\S]*?\)\}/m;
const newRender = `{el.type === 'cta' ? (
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
                                )}`;
code = code.replace(renderRegex, newRender);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Patched layout!');
