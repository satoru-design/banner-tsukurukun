const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add activeDesignSpecs state
if (!content.includes('const [activeDesignSpecs, setActiveDesignSpecs] = useState<any>(null);')) {
  content = content.replace(
    `const [layoutStyle, setLayoutStyle] = useState<'left'|'right'|'center'>('left');`,
    `const [layoutStyle, setLayoutStyle] = useState<'left'|'right'|'center'>('left');\n  const [activeDesignSpecs, setActiveDesignSpecs] = useState<any>(null);`
  );
}

// 2. Add renderRichText helper
if (!content.includes('const renderRichText =')) {
  const helper = `\nconst renderRichText = (text: string, accentColor: string) => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\\/mark>)/);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <span key={i} style={{ color: accentColor, fontSize: '1.5em', display: 'inline-block', lineHeight: 1.2 }}>{part.replace(/<\\/?mark>/g, '')}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};\n`;
  content = content.replace(`// Base64 helper`, helper + `\n// Base64 helper`);
}

// 3. Update selectAngle
const oldSelectAngle = /const selectAngle = \(index: number\) => {[\s\S]*?setStep\(3\);[^}]*};/;
const newSelectAngle = `const selectAngle = (index: number) => {
    setActiveAngleIdx(index);
    const v = variations[index];
    setManualMainCopy(v.copy?.main_copy || v.mainCopy || "");
    setManualSubCopy(v.copy?.sub_copy || v.subCopy || "");
    setManualImagePrompt(v.design_specs?.image_gen_prompt || v.imagePrompt || "");
    if (v.copy?.cta_text) setCtaText(v.copy.cta_text);
    if (v.design_specs?.tone_and_manner) setBannerTone(v.design_specs.tone_and_manner);
    setActiveDesignSpecs(v.design_specs || null);
    
    if (v.design_specs && v.design_specs.layout_id) {
       const lid = v.design_specs.layout_id;
       setLayoutStyle(lid === 'center-focus' ? 'center' : (lid === 'right-text' ? 'right' : 'left'));
    }
    setStep(3); // -> Proceed to Step 3 (Banner Conditions)
  };`;
content = content.replace(oldSelectAngle, newSelectAngle);

// 4. Update Step 2 Variations Mapping
content = content.replace(/<h3 className="font-black text-xl text-emerald-400 mb-4">{v\.angle}<\/h3>/g, `<h3 className="font-black text-xl text-emerald-400 mb-4">{v.strategy?.angle || v.angle}</h3>`);
content = content.replace(/<label className="text-xs text-neutral-500 font-bold block mb-1">メインコピー<\/label>\s*<p className="font-bold text-white text-lg">{v\.mainCopy}<\/p>/g, `<label className="text-xs text-neutral-500 font-bold block mb-1">メインコピー</label>\n                       <p className="font-bold text-white text-lg">{v.copy?.main_copy || v.mainCopy}</p>`);
content = content.replace(/<label className="text-xs text-neutral-500 font-bold block mb-1">サブコピー<\/label>\s*<p className="text-sm text-neutral-300">{v\.subCopy}<\/p>/g, `<label className="text-xs text-neutral-500 font-bold block mb-1">サブコピー</label>\n                       <p className="text-sm text-neutral-300">{v.copy?.sub_copy || v.subCopy}</p>`);

// 5. Update enterEditor initialization array
const oldInitElements = /const initialElements: CanvasElement\[\] = \[[\s\S]*?\];/;
const newInitElements = `    const layoutId = activeDesignSpecs?.layout_id || (isLeft ? 'split-screen' : 'z-pattern');
    const accentColor = activeDesignSpecs?.color_palette?.accent || "#38bdf8";
    const mainColor = activeDesignSpecs?.color_palette?.main || "#ffffff";
    
    let initialElements: CanvasElement[] = [];

    // Background plate for split-screen
    if (layoutId === 'split-screen') {
       initialElements.push({
         id: 'bg-plate', type: 'shape', content: '', 
         style: "w-full h-full rounded shadow-xl",
         composeMode: "bg-plate",
         textStyle: { color: '', backgroundColor: 'rgba(0,0,0,0.65)', fontSize: 0, fontWeight: 'normal', textAlign: 'left' },
         defaultPos: { x: tx - 20, y: canvasSize.h * 0.1 - 20, w: tw + 40, h: canvasSize.h * 0.8 + 40 }
       });
    }

    initialElements.push({ 
        id: 'main-text', type: 'main', content: manualMainCopy, 
        style: "p-4 leading-tight inline-block resize-none w-full h-full overflow-hidden break-all whitespace-pre-wrap focus:outline-none bg-transparent",
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: mainColor, backgroundColor: "transparent", fontSize: 50, fontWeight: "900", textAlign: layoutId === 'z-pattern' ? "center" : "left" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.1, y: canvasSize.h * 0.2, w: canvasSize.w * 0.8, h: canvasSize.h * 0.4 } : { x: tx, y: canvasSize.h * 0.1, w: tw, h: canvasSize.h*0.4 }
    });

    initialElements.push({ 
        id: 'sub-text', type: 'sub', content: manualSubCopy, 
        style: "px-6 py-3 rounded-full shadow-xl break-all whitespace-pre-wrap resize-none w-full h-full overflow-hidden flex items-center justify-center focus:outline-none bg-transparent",
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#000000", backgroundColor: "#ffffff", fontSize: 24, fontWeight: "700", textAlign: "center" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.2, y: canvasSize.h * 0.5, w: canvasSize.w * 0.6, h: 80 } : { x: tx, y: canvasSize.h * 0.55, w: tw, h: 100 }
    });

    if (hasCta === 'yes') {
        initialElements.push({
            id: 'cta-btn', type: 'cta', content: ctaText,
            style: "px-6 py-3 rounded-full shadow-2xl transition-transform hover:scale-105 cursor-pointer flex items-center justify-center outline-none",
            textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "transparent", textShadow: "0px 4px 10px rgba(0,0,0,0.3)", color: "#ffffff", backgroundColor: accentColor, fontSize: 32, fontWeight: "900", textAlign: "center" },
            defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.6, y: canvasSize.h * 0.8, w: 350, h: 90 } : { x: tx + (tw - 300)/2, y: canvasSize.h * 0.75, w: 300, h: 90 }
        });
    }

    logosBase64.forEach((logo, i) => {
        initialElements.push({
            id: 'logo-' + i, type: 'image', content: logo, style: "w-full h-full object-contain", textStyle: {} as any,
            defaultPos: layoutId === 'z-pattern' ? { x: 40, y: 40, w: 200, h: 60 } : { x: tx, y: 40 + (i*70), w: 150, h: 50 }
        });
    });

    productImagesBase64.forEach((img, i) => {
        initialElements.push({
            id: 'product-' + i, type: 'image', content: img, style: "w-full h-full object-contain", textStyle: {} as any, composeMode: 'product-shadow',
            defaultPos: { x: layoutId === 'split-screen' ? canvasSize.w * 0.55 + (i*80) : canvasSize.w * 0.05 + (i*80), y: canvasSize.h * 0.4, w: 350, h: 450 }
        });
    });`;
content = content.replace(oldInitElements, newInitElements);

// 6. Update Render Element properties sidebar to let them edit main text with <mark>
const sidebarInsertLoc = `<div className="grid grid-cols-2 gap-2 mt-2">`;
if (!content.includes('テキスト内容 (リッチテキスト・<mark>タグ編集)')) {
  const customEditor = `
                     {activeEl.type === 'main' && (
                        <div className="mt-4 pt-4 border-t border-teal-500/30">
                           <label className="block text-neutral-400 mb-1 text-xs">テキスト内容 (リッチテキスト・&lt;mark&gt;タグ編集)</label>
                           <textarea value={activeEl.content} onChange={e => updateText(activeEl.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white resize-y min-h-24 outline-none focus:border-teal-500" placeholder="<mark>強調文字</mark>を入力" />
                        </div>
                     )}
                     `;
  content = content.replace(sidebarInsertLoc, customEditor + sidebarInsertLoc);
}

// 7. Render Rich Text for main-text replacing the textarea completely
const textareaRegex = /<textarea className={`no-drag outline-none flex-grow \${el\.style}`} style={{ fontFamily: el\.textStyle\.fontFamily, textShadow: el\.textStyle\.textShadow, WebkitTextStroke: `\${el\.textStyle\.textStrokeWidth || 0}px \${el\.textStyle\.textStrokeColor || 'transparent'}`, color: el\.textStyle\.color, backgroundColor: el\.textStyle\.backgroundColor, fontSize: `\${el\.textStyle\.fontSize}px`, fontWeight: el\.textStyle\.fontWeight, textAlign: el\.textStyle\.textAlign }} value={el\.content} onChange=\{e => updateText\(el\.id, e\.target\.value\)\} \/>/;

const richTextDiv = `{el.type === 'main' ? (
                                <div className={\`no-drag flex-grow outline-none \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                   {renderRichText(el.content, activeDesignSpecs?.color_palette?.accent || '#FFD700')}
                                </div>
                             ) : el.type === 'shape' ? (
                                <div className={el.style} style={{ backgroundColor: el.textStyle.backgroundColor, opacity: 0.8 }} />
                             ) : (
                                <textarea className={\`no-drag outline-none flex-grow \${el.style}\`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }} value={el.content} onChange={e => updateText(el.id, e.target.value)} />
                             )}`;

content = content.replace(textareaRegex, richTextDiv);


fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log('Migration complete!');
