const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add containerRef, scale state, and useEffect
const stateAnchor = `  const canvasRef = useRef<HTMLDivElement>(null);`;
const stateAdd = `  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);
  
  React.useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = window.innerHeight * 0.7;
      const calculatedScale = Math.min(cw / canvasSize.w, ch / canvasSize.h, 1);
      setViewScale(calculatedScale);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSize, step]);`;

code = code.replace(stateAnchor, stateAdd);

// 2. Fix the layout default width (tw + 80 -> tw + 150) and color contrast for text
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
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: layoutId === 'split-screen' ? '#ffffff' : mainColor, backgroundColor: "transparent", fontSize: 60, fontWeight: "900", textAlign: layoutId === 'z-pattern' ? "center" : "left" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.1, y: canvasSize.h * 0.15, w: canvasSize.w * 0.8, h: canvasSize.h * 0.4 } : { x: tx, y: canvasSize.h * 0.15, w: canvasSize.w * 0.55, h: canvasSize.h*0.4 }
    });

    initialElements.push({ 
        id: 'sub-text', type: 'sub', content: manualSubCopy, 
        style: "px-6 py-4 rounded-xl shadow-2xl break-keep whitespace-pre-wrap resize-none w-full h-full flex items-center justify-center focus:outline-none bg-transparent",
        textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "#000000", textShadow: "none", color: "#000000", backgroundColor: "#ffffff", fontSize: 24, fontWeight: "800", textAlign: "center" },
        defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.2, y: canvasSize.h * 0.55, w: canvasSize.w * 0.6, h: 80 } : { x: tx, y: canvasSize.h * 0.6, w: canvasSize.w * 0.55, h: 100 }
    });

    if (hasCta === 'yes') {
        initialElements.push({
            id: 'cta-btn', type: 'cta', content: ctaText,
            style: "px-8 py-4 rounded-full shadow-2xl transition-transform hover:scale-105 cursor-pointer flex items-center justify-center outline-none",
            textStyle: { fontFamily: "'Noto Sans JP', sans-serif", textStrokeWidth: 0, textStrokeColor: "transparent", textShadow: "0px 4px 15px rgba(0,0,0,0.4)", color: "#ffffff", backgroundColor: accentColor, fontSize: 32, fontWeight: "900", textAlign: "center" },
            defaultPos: layoutId === 'z-pattern' ? { x: canvasSize.w * 0.65, y: canvasSize.h * 0.8, w: 350, h: 90 } : { x: tx, y: canvasSize.h * 0.8, w: canvasSize.w * 0.55, h: 90 }
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

// 3. Fix the Canvas rendering frame to be fully responsive
const frameRegex = /<div className="lg:col-span-3 flex justify-center overflow-x-auto bg-neutral-950 p-8 rounded-2xl relative min-h-\[800px\] items-start">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\};/m;
const newFrame = `<div className="lg:col-span-3 flex justify-center bg-neutral-950 p-4 sm:p-8 rounded-2xl relative min-h-[600px] items-center overflow-hidden">
               {(() => {
                 return (
                  <div ref={containerRef} className="w-full flex justify-center">
                    <div style={{ width: canvasSize.w * viewScale, height: canvasSize.h * viewScale, position: 'relative' }}>
                      <div 
                         ref={canvasRef}
                         className="relative bg-white overflow-hidden shadow-2xl transition-all duration-300"
                         style={{
                           width: canvasSize.w, height: canvasSize.h,
                           minWidth: canvasSize.w, minHeight: canvasSize.h,
                           transform: \`scale(\${viewScale})\`, transformOrigin: 'top left',
                           border: 'none',
                           backgroundImage: generatedBg ? \`url(\${generatedBg})\` : 'linear-gradient(to bottom right, #f8fafc, #e2e8f0)',
                           backgroundSize: 'cover', backgroundPosition: 'center',
                         }}
                         onClick={() => setSelectedElementId(null)}
                      >
                         {/* Draggable Elements */}
                         {editorTexts.map((el) => (
                            <Rnd 
                               key={el.id} default={{ x: el.defaultPos.x, y: el.defaultPos.y, width: (el.defaultPos as any).w || (el.defaultPos as any).width, height: (el.defaultPos as any).h || (el.defaultPos as any).height }} bounds="parent" cancel=".no-drag"
                               onDragStart={() => setSelectedElementId(el.id)}
                               onClickCapture={(e: any) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                            >
                               <div className={\`border-2 group flex flex-col p-1 cursor-move transition-colors w-full h-full \${selectedElementId === el.id ? 'border-teal-500' : 'border-transparent hover:border-dashed hover:border-teal-500/50'}\`}>
                                  {el.type === 'cta' ? (
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
                               </div>
                            </Rnd>
                         ))}
                      </div>
                    </div>
                  </div>
                 );
               })()}`;

code = code.replace(frameRegex, newFrame);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Responsive patch done!');
