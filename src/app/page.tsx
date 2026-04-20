'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Copy, Wand2, Download, Image as ImageIcon, LayoutTemplate, ScanEye, Zap, Scaling, Plus, Type, Palette, History, Share2, Save, ImagePlus, User, MousePointerClick } from "lucide-react";
import { Rnd } from "react-rnd";
import html2canvas from "html2canvas";

type CanvasSize = { w: number, h: number, name: string };
const SIZES: CanvasSize[] = [
  { name: 'Instagram (1080x1080)', w: 1080, h: 1080 },
  { name: 'FB/GDN (1200x628)', w: 1200, h: 628 },
  { name: 'Stories (1080x1920)', w: 1080, h: 1920 },
];

const PROMPT_SAMPLES = [
  { label: "クリーンな美容・コスメ系", text: "A radiant healthy woman standing in soft golden morning light, glowing skin, clean white background with subtle botanical elements, lifestyle wellness photography, high resolution" },
  { label: "信頼感のあるBtoB系", text: "A modern bright office interior with abstract glass reflection, minimalist corporate background, blue and silver color palette, depth of field, 8k resolution" },
  { label: "力強いサプリ・ダイエット系", text: "Dynamic burst of energy and water splash, vibrant colors, dark background with glowing particle effects, dramatic lighting, highly detailed 3d render" },
];

type CanvasElement = {
  id: string;
  type: string;
  content: string; // for image, this holds base64
  style: string;
  composeMode?: string;
  textStyle: {
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontWeight: string;
    textAlign: "left" | "center" | "right";
    fontFamily?: string;
    textStrokeWidth?: number;
    textStrokeColor?: string;
    textShadow?: string;
  };
  defaultPos: { x: number, y: number, w: number | string, h: number | string };
};

// Base64 helper
const readAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

const renderRichText = (text: string, accentColor: string) => {
  if (!text) return null;
  const parts = text.split(/(<mark>.*?<\/mark>)/);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <span key={i} style={{ color: accentColor, fontSize: '1.5em', display: 'inline-block', lineHeight: 1.2 }}>{part.replace(/<\/?mark>/g, '')}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

export default function BannerBuilder() {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const [showDashboard, setShowDashboard] = useState(false);
  const [savedBanners, setSavedBanners] = useState<any[]>([]);

  // ---- Step 1: Input State ----
  const [inputMode, setInputMode] = useState<'lp' | 'image'>('lp');
  const [url, setUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [target, setTarget] = useState('');
  const [insightData, setInsightData] = useState<any>(null);
  const [lpRawText, setLpRawText] = useState<string>('');
  
  // ---- Step 2: Generation State ----
  const [variations, setVariations] = useState<any[]>([]);
  const [activeAngleIdx, setActiveAngleIdx] = useState(0);
  
  // ---- Step 3: Banner Conditions State ----
  const [manualMainCopy, setManualMainCopy] = useState('');
  const [manualSubCopy, setManualSubCopy] = useState('');
  const [manualImagePrompt, setManualImagePrompt] = useState('');
  const [baseImagePrompt, setBaseImagePrompt] = useState('');
  const [hasPerson, setHasPerson] = useState<'yes'|'no'|'any'>('any');
  const [personAttr, setPersonAttr] = useState('');
  const [hasProductImage, setHasProductImage] = useState<'yes'|'no'>('no');
  const [productImagesBase64, setProductImagesBase64] = useState<string[]>([]);
  const [hasLogo, setHasLogo] = useState<'yes'|'no'>('no');
  const [logosBase64, setLogosBase64] = useState<string[]>([]);
  const [hasCta, setHasCta] = useState<'yes'|'no'>('yes');
  const [ctaText, setCtaText] = useState('今すぐ詳細を見る');
  const [bannerTone, setBannerTone] = useState('');
  const [layoutStyle, setLayoutStyle] = useState<'left'|'right'|'center'>('left');
  const [activeDesignSpecs, setActiveDesignSpecs] = useState<any>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  
  // ---- Mega-Prompt Realtime Engine ----
  React.useEffect(() => {
    if (!baseImagePrompt && step < 3) return;
    
    let layoutInstruction = "";
    if (layoutStyle === 'left') layoutInstruction = "-- Layout & Composition --\n[CRITICAL RULE]: The ENTIRE LEFT HALF of the image MUST definitively be completely empty, clean negative space (e.g., solid studio wall, clear smooth surface). Place the main primary subject STRICTLY AND ONLY on the FAR RIGHT EDGE. Do not place any objects, limbs, or textures in the left half, it must remain pristine for typography overlay.";
    else if (layoutStyle === 'right') layoutInstruction = "-- Layout & Composition --\n[CRITICAL RULE]: The ENTIRE RIGHT HALF of the image MUST definitively be completely empty, clean negative space. Place the main primary subject STRICTLY AND ONLY on the FAR LEFT EDGE. Do not place any objects, limbs, or textures in the right half.";
    else if (layoutStyle === 'center') layoutInstruction = "-- Layout & Composition --\n[CRITICAL RULE]: Leave a massive, clean, empty negative space in the dead center. The subject and visual elements should solely frame the outer borders.";

    const personConstraint = hasPerson === 'yes' ? `\n-- Subject Specifications --\nThe scene MUST prominently feature a human subject. Attributes required: ${personAttr || "Professional, highly natural, perfectly fitting the commercial product context"}. Authentic expression, vivid details.` 
                           : (hasPerson === 'no' ? `\n-- Subject Specifications --\n[STRICT RULE]: ABSOLUTELY NO PEOPLE. The image must be entirely devoid of any human presence or body parts. Focus entirely on the environment and atmosphere.` : "\n-- Subject Specifications --\nSubject can be human or abstract, but must fit the core theme.");

    const toneConstraint = `\n-- Atmosphere, Lighting & Tone --\nOverall design tone: ${bannerTone || "Clean, commercial photography quality"}. Lighting should be masterfully crafted, with cinematic depth of field, balanced shadows, and high-end advertising rendering.`;

    const userAdditions = additionalInstructions ? `\n-- Additional Custom Instructions --\n${additionalInstructions}` : "";

    const finalMegaPrompt = `${layoutInstruction}${personConstraint}${toneConstraint}\n\n-- Core Visual Description --\n${baseImagePrompt}\n\n-- Technical Specs --\n4k, highly detailed, photorealistic, professional lighting, no text, no watermarks, flawless aesthetic.${userAdditions}`;
    
    setManualImagePrompt(finalMegaPrompt);
  }, [layoutStyle, bannerTone, hasPerson, personAttr, additionalInstructions, baseImagePrompt]);

  // ---- Step 4: Editor State ----
  const [generatedBg, setGeneratedBg] = useState<string|null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(SIZES[0]);
  const [editorTexts, setEditorTexts] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);
  
  React.useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = window.innerHeight * 0.7;
      const calculatedScale = Math.min((cw - 16) / canvasSize.w, (ch - 16) / canvasSize.h, 1);
      setViewScale(calculatedScale);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasSize, step]);

  const fetchSavedBanners = async () => {
    try {
      const res = await fetch('/api/save-banner');
      const data = await res.json();
      setSavedBanners(data.banners || []);
    } catch(e) { console.error(e); }
  };

  const handleSaveList = async () => {
    if(!canvasRef.current) return;
    setLoading(true); setLoadingMsg("マイリストに保存中...");
    try {
       setSelectedElementId(null);
       await new Promise(r => setTimeout(r, 100)); 
       const canvas = await html2canvas(canvasRef.current, { scale: 1, useCORS: true });
       const b64 = canvas.toDataURL('image/jpeg', 0.8);
       const v = variations[activeAngleIdx];
       
       const res = await fetch('/api/save-banner', {
           method: 'POST', headers: {'Content-Type':'application/json'},
           body: JSON.stringify({
               productName, lpUrl: url, target, mainCopy: manualMainCopy, subCopy: manualSubCopy,
               elements: editorTexts, base64Image: b64, angle: v?.strategy?.angle || 'Manual'
           })
       });
       if(res.ok) alert("マイリストに保存されました！");
    } finally { setLoading(false); }
  };

  const handleSlackShare = async () => {
    const v = variations[activeAngleIdx];
    const message = `【AI自動生成バナー報告】\n商品: ${productName||'未設定'}\nアングル: ${v?.strategy?.angle||'Manual'}\n\n【メインコピー】\n${manualMainCopy}\n\n【サブコピー】\n${manualSubCopy}\n\nシステムで初稿を生成しました！`;
    try {
        setLoading(true); setLoadingMsg("チームに共有中...");
        const res = await fetch('/api/share', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message, webhookUrl: '' })
        });
        const data = await res.json();
        alert(data.mock ? "モック環境としてローカルで通知成功しました！" : "Slack送信完了");
    } finally { setLoading(false); }
  };

  const handleAnalyzeLp = async () => {
    if (!url) return alert('URLを入力してください');
    setLoading(true); setLoadingMsg("LPをスクレイピングしてインサイトを解析中...");
    try {
      const res = await fetch('/api/analyze-lp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsightData(data.insights);
      setLpRawText(data.lpText);
    } catch (err: any) { alert("LP解析エラー: " + err.message); }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await readAsBase64(file);
    setLoading(true); setLoadingMsg("AIがバナー画像を解析中...");
    try {
      const res = await fetch('/api/analyze-banner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsightData(data.insights);
    } catch (err: any) { alert("解析エラー: " + err.message); }
    setLoading(false);
  };

  const handleFileUploadForConditions = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const promises = files.map(f => readAsBase64(f));
    const base64s = await Promise.all(promises);
    setter(prev => [...prev, ...base64s]);
  };

  const handleGenerateCopy = async () => {
    setLoading(true); setLoadingMsg("AIが戦略を構築中...");
    try {
      const insightsStr = insightData ? JSON.stringify(insightData) : '';
      const res = await fetch('/api/generate-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, target, competitorInsights: insightsStr, lpText: lpRawText })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setVariations(data.variations);
      setStep(2);
    } catch (err: any) { alert("生成エラー: " + err.message); } 
      finally { setLoading(false); }
  };

  const selectAngle = (index: number) => {
    setActiveAngleIdx(index);
    const v = variations[index];
    setManualMainCopy(v.copy?.main_copy || "");
    setManualSubCopy(v.copy?.sub_copy || "");
    setBaseImagePrompt(v.design_specs?.image_gen_prompt || "");
    // Don't set setManualImagePrompt here directly, let useEffect handle it
    if (v.copy?.cta_text) setCtaText(v.copy.cta_text);
    if (v.design_specs?.tone_and_manner) setBannerTone(v.design_specs.tone_and_manner);
    setActiveDesignSpecs(v.design_specs || null);
    
    if (v.design_specs && v.design_specs.layout_id) {
       const lid = v.design_specs.layout_id;
       setLayoutStyle(lid === 'center-focus' ? 'center' : (lid === 'split-screen' ? 'left' : 'left'));
    }
    setStep(3);
  };

  const handleGenerateBg = async () => {
    const masterPrompt = manualImagePrompt;

    setLoading(true); setLoadingMsg("AIが指定条件をもとに背景画像を生成中...");
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: masterPrompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setGeneratedBg(data.imageUrl);
      enterEditor(data.imageUrl);
    } catch (err: any) { alert("画像生成エラー: " + err.message); }
      finally { setLoading(false); }
  };

  const enterEditor = (bgUrl: string) => {
    const isLeft = layoutStyle === 'left';
    
    let tx = canvasSize.w * 0.05;
    let tw = canvasSize.w * 0.45;
    if (isLeft) {
      tx = canvasSize.w * 0.05; tw = canvasSize.w * 0.45; 
    } else if (layoutStyle === 'center') {
      tx = canvasSize.w * 0.1; tw = canvasSize.w * 0.8;
    } else {
      tx = canvasSize.w * 0.50; tw = canvasSize.w * 0.45;
    }

    const layoutId = activeDesignSpecs?.layout_id || (isLeft ? 'split-screen' : 'z-pattern');
    const accentColor = activeDesignSpecs?.color_palette?.accent || "#38bdf8";
    const mainColor = activeDesignSpecs?.color_palette?.main || "#ffffff";
    
    let initialElements: CanvasElement[] = [];

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

    setEditorTexts(initialElements);
    setStep(4);
  };

  const updateText = (id: string, text: string) => {
    setEditorTexts(prev => prev.map(el => el.id === id ? { ...el, content: text } : el));
  };
  const updateActiveElementStyle = (key: keyof CanvasElement['textStyle'], value: any) => {
    if (!selectedElementId) return;
    setEditorTexts(prev => prev.map(el => el.id === selectedElementId ? { ...el, textStyle: { ...el.textStyle, [key]: value } } : el));
  };

  const activeEl = editorTexts.find(e => e.id === selectedElementId);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 pb-20">
      
      {/* Header */}
      <header className="bg-neutral-950 border-b border-neutral-800 p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-teal-500 p-2 rounded-lg"><Zap className="text-white w-6 h-6" /></div>
             <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-500 tracking-tight">AntigravityCreative</h1>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={()=>setShowDashboard(!showDashboard)} className="text-sm font-bold text-neutral-400 hover:text-white flex items-center gap-2"><History className="w-4 h-4"/> 過去の生成</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 mt-4">
        
        {loading && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center z-50 flex-col gap-6">
            <div className="relative w-24 h-24">
               <div className="absolute inset-0 rounded-full border-t-4 border-teal-500 animate-spin"></div>
               <div className="absolute inset-2 rounded-full border-t-4 border-emerald-400 animate-spin-reverse"></div>
               <Wand2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-teal-300 w-8 h-8 animate-pulse" />
            </div>
            <p className="text-teal-300 font-bold text-lg tracking-widest animate-pulse">{loadingMsg}</p>
          </div>
        )}

        {/* Step 1: Input Analysis */}
        {step === 1 && (
          <div className="space-y-6">
             <div className="flex items-center gap-2 mb-2">
                <span className="bg-teal-500/20 text-teal-400 p-2 rounded text-sm font-black tracking-widest">STEP 1.</span>
                <h2 className="text-2xl font-bold text-white">情報入力とAI解析</h2>
             </div>

             <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-neutral-800 border-neutral-700 shadow-xl overflow-hidden hover:border-teal-500/50 transition-colors">
                  <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-500" />
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2"><ScanEye /> 入力ソース</CardTitle>
                    <CardDescription className="text-neutral-400">LPのURLか既存バナー画像をアップロード</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex bg-neutral-900 rounded p-1 border border-neutral-700">
                      <button onClick={() => setInputMode('lp')} className={`flex-1 py-2 text-sm font-bold rounded ${inputMode === 'lp' ? 'bg-neutral-700 text-white' : 'text-neutral-500'}`}>LP URL</button>
                      <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-sm font-bold rounded ${inputMode === 'image' ? 'bg-neutral-700 text-white' : 'text-neutral-500'}`}>画像アップロード</button>
                    </div>

                    {inputMode === 'lp' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-neutral-400 font-bold mb-1 block">商材LPのURL (必須)</label>
                          <div className="flex gap-2">
                            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="flex-grow bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none" />
                            <button onClick={handleAnalyzeLp} className="bg-teal-600 hover:bg-teal-500 text-white px-4 font-bold rounded shadow-lg whitespace-nowrap text-sm flex items-center gap-1"><ScanEye className="w-4 h-4"/> 解析</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400 font-bold mb-1 block">商材名</label>
                          <input type="text" value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400 font-bold mb-1 block">ターゲット層</label>
                          <input type="text" value={target} onChange={e => setTarget(e.target.value)} placeholder="例：30代女性、肌荒れに悩んでいる" className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         <div className="border-2 border-dashed border-neutral-600 rounded-xl p-8 text-center hover:border-teal-500 transition-colors bg-neutral-900/50 cursor-pointer relative">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <ImageIcon className="mx-auto h-12 w-12 text-neutral-500 mb-3" />
                            <p className="text-sm text-neutral-400 font-bold">クリックまたはドラッグ＆ドロップで画像をアップロード</p>
                            <p className="text-xs text-neutral-500 mt-2">AIが画像を解析し、訴求力のある新コピーを生成します</p>
                         </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-neutral-800 border-t border-neutral-700 mt-4">
                    <button onClick={handleGenerateCopy} className="w-full py-4 rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg text-lg flex justify-center items-center gap-2"><Wand2 /> AIで4つの戦略を生成する</button>
                  </CardFooter>
                </Card>

                <Card className="bg-neutral-800 border-neutral-700 shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-white">Gemini 分析インサイト</CardTitle>
                    <CardDescription className="text-neutral-400">画像アップロード時に抽出された分析結果</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {insightData ? (
                      <div className="space-y-4 bg-neutral-900 p-4 rounded border border-neutral-700">
                        <div><span className="font-bold text-teal-400">推測される商材:</span> {insightData.inferred_product_name}</div>
                        <div><span className="font-bold text-teal-400">ターゲット:</span> {insightData.inferred_target_demographic}</div>
                        <div><span className="font-bold text-teal-400">メイン訴求:</span> {insightData.main_appeal}</div>
                        {insightData.worldview && <div><span className="font-bold text-teal-400">世界観/トーン:</span> {insightData.worldview}</div>}
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-neutral-600">解析データ待ち</div>
                    )}
                  </CardContent>
                </Card>
             </div>
          </div>
        )}

        {/* Step 2: Copy Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
               <Type className="text-teal-400" /> 広告コピーの選択
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              {variations.map((v, i) => (
                <div key={i} className="p-6 rounded-xl border-2 border-neutral-700 bg-neutral-800 hover:border-teal-500 transition-all group relative">
                  <h3 className="font-black text-xl text-emerald-400 mb-4">{v.strategy?.angle}</h3>
                  <div className="space-y-4 mb-4">
                    <div>
                       <label className="text-xs text-neutral-500 font-bold block mb-1">メインコピー</label>
                       <p className="font-bold text-white text-lg">{v.copy?.main_copy}</p>
                    </div>
                    <div>
                       <label className="text-xs text-neutral-500 font-bold block mb-1">サブコピー</label>
                       <p className="text-sm text-neutral-300">{v.copy?.sub_copy}</p>
                    </div>
                  </div>
                  <button onClick={() => selectAngle(i)} className="w-full bg-neutral-700 group-hover:bg-teal-600 text-white font-bold p-3 rounded-lg flex items-center justify-center gap-2">
                     このアングルを使って次へ進む
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-4 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">Step 1に戻る</button>
          </div>
        )}

        {/* Step 3: Banner Conditions Formulation */}
        {step === 3 && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
               <LayoutTemplate className="text-teal-400" /> STEP3: バナー条件の整理
            </h2>
            <Card className="bg-neutral-800 border-neutral-700 shadow-xl overflow-hidden">
               <div className="p-6 border-b border-neutral-700 bg-neutral-800/50">
                  <h3 className="font-bold text-teal-400 mb-4"><Type className="w-5 h-5 inline mr-1"/> バナーに載せるコピー</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-sm text-neutral-300 mb-1 font-bold">【メインコピー】</label>
                        <textarea value={manualMainCopy} onChange={e=>setManualMainCopy(e.target.value)} className="w-full h-16 bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none resize-none" />
                     </div>
                     <div>
                        <label className="block text-sm text-neutral-300 mb-1 font-bold">【サブコピー】</label>
                        <textarea value={manualSubCopy} onChange={e=>setManualSubCopy(e.target.value)} className="w-full h-16 bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none resize-none" />
                     </div>
                  </div>
               </div>

               <div className="p-6 grid md:grid-cols-2 gap-8">
                  {/* People */}
                  <div className="space-y-4">
                     <div>
                        <h4 className="font-bold text-white mb-2"><User className="w-4 h-4 inline mr-1 text-emerald-400"/> 人物の有無</h4>
                        <div className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white">
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasPerson==='yes'} onChange={()=>setHasPerson('yes')}/> あり</label>
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasPerson==='no'} onChange={()=>setHasPerson('no')}/> なし</label>
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasPerson==='any'} onChange={()=>setHasPerson('any')}/> どちらでも</label>
                        </div>
                     </div>
                  </div>

                  {/* Product Image */}
                  <div className="space-y-4">
                     <div>
                        <h4 className="font-bold text-white mb-2"><ImagePlus className="w-4 h-4 inline mr-1 text-emerald-400"/> 商品画像の有無</h4>
                        <div className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white">
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasProductImage==='yes'} onChange={()=>setHasProductImage('yes')}/> あり</label>
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasProductImage==='no'} onChange={()=>setHasProductImage('no')}/> なし</label>
                        </div>
                     </div>
                     <div>
                        <input type="file" id="prod-upload" accept="image/*" multiple onChange={(e)=>handleFileUploadForConditions(e, setProductImagesBase64)} disabled={hasProductImage==='no'} className="hidden" />
                        <label htmlFor="prod-upload" className={`px-4 py-2 text-sm rounded font-bold cursor-pointer ${hasProductImage==='yes' ? 'bg-neutral-700 hover:bg-neutral-600 text-white' : 'bg-neutral-800 text-neutral-600'}`}>ファイルを選択</label>
                        {productImagesBase64.length > 0 && <span className="text-teal-400 text-xs ml-2">✅ {productImagesBase64.length}枚</span>}
                     </div>
                  </div>

                  {/* Logo */}
                  <div className="space-y-4">
                     <div>
                        <h4 className="font-bold text-white mb-2"><LayoutTemplate className="inline w-4 h-4 mr-1 text-emerald-400"/> ロゴの有無</h4>
                        <div className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white">
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasLogo==='yes'} onChange={()=>setHasLogo('yes')}/> あり</label>
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasLogo==='no'} onChange={()=>setHasLogo('no')}/> なし</label>
                        </div>
                     </div>
                     <div>
                        <input type="file" id="logo-upload" accept="image/*" multiple onChange={(e)=>handleFileUploadForConditions(e, setLogosBase64)} disabled={hasLogo==='no'} className="hidden" />
                        <label htmlFor="logo-upload" className={`px-4 py-2 text-sm rounded font-bold cursor-pointer ${hasLogo==='yes' ? 'bg-neutral-700 hover:bg-neutral-600 text-white' : 'bg-neutral-800 text-neutral-600'}`}>ファイルを選択</label>
                        {logosBase64.length > 0 && <span className="text-teal-400 text-xs ml-2">✅ {logosBase64.length}枚</span>}
                     </div>
                  </div>

                  {/* CTA Text */}
                  <div className="space-y-4">
                     <div>
                        <h4 className="font-bold text-white mb-2"><MousePointerClick className="w-4 h-4 inline mr-1 text-emerald-400"/> CTAボタンの有無</h4>
                        <div className="flex gap-4 text-sm bg-neutral-900 p-2 rounded border border-neutral-700 text-white">
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasCta==='yes'} onChange={()=>setHasCta('yes')}/> あり</label>
                           <label className="cursor-pointer"><input type="radio" className="accent-teal-500 mr-1" checked={hasCta==='no'} onChange={()=>setHasCta('no')}/> なし</label>
                        </div>
                     </div>
                     <div>
                        <input type="text" value={ctaText} onChange={e=>setCtaText(e.target.value)} disabled={hasCta==='no'} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white disabled:opacity-50" />
                     </div>
                  </div>
                  
                  {/* Style Constraints */}
                  <div className="col-span-1 md:col-span-2 border-t border-neutral-700 pt-6 mt-2">
                     <h4 className="font-bold text-white mb-4"><Palette className="w-4 h-4 inline mr-1 text-emerald-400"/> トーン＆構図・AIへの指示</h4>
                     <div className="grid md:grid-cols-3 gap-6">
                        <div>
                           <label className="block text-xs font-bold text-neutral-400 mb-1">基本のレイアウト構図</label>
                           <select value={layoutStyle} onChange={e=>setLayoutStyle(e.target.value as any)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white focus:border-teal-500">
                              <option value="left">左テキスト / 右メイン被写体</option>
                              <option value="right">右テキスト / 左メイン被写体</option>
                              <option value="center">中央テキストのみ (全体被写体)</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-neutral-400 mb-1">バナー全体のトーン (任意)</label>
                           <input type="text" value={bannerTone} onChange={e=>setBannerTone(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-neutral-400 mb-1">画像生成プロンプト</label>
                           <textarea value={manualImagePrompt} onChange={e=>setManualImagePrompt(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs text-neutral-300 resize-none h-16" />
                        </div>
                     </div>
                     <div className="pt-4">
                        <label className="block text-xs font-bold text-neutral-400 mb-1">その他補足事項</label>
                        <textarea value={additionalInstructions} onChange={e=>setAdditionalInstructions(e.target.value)} className="w-full h-16 bg-neutral-900 border border-neutral-700 rounded p-3 text-sm text-white focus:border-teal-500 outline-none resize-none" />
                     </div>
                  </div>
               </div>
            </Card>

            <div className="flex justify-between items-center pt-4">
               <button onClick={()=>setStep(2)} className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">Step 2に戻る</button>
               <button onClick={handleGenerateBg} className="px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 rounded-xl text-white font-black text-lg shadow-lg hover:scale-105 transition-transform"><Wand2 className="inline mr-2"/> 背景画像を生成してエディタへ</button>
            </div>
          </div>
        )}

        {/* Step 4: Editor Canvas */}
        {step === 4 && (
          <div className="grid lg:grid-cols-4 gap-8">
             <div className="space-y-6">
                
                {/* Properties Panel */}
                {activeEl && activeEl.type !== 'image' && (
                  <Card className="bg-neutral-800 border-teal-500 p-4 space-y-4 shadow-lg shadow-teal-900/20">
                     <h3 className="font-bold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-teal-400" /> 文字スタイル編集</h3>
                     
                     {['main', 'sub', 'cta'].includes(activeEl.type) && (
                        <div className="mt-4 pt-2 border-t border-teal-500/30">
                           <label className="block text-neutral-400 mb-1 text-xs">テキスト内容 (リッチテキスト編集)</label>
                           <textarea value={activeEl.content} onChange={e => updateText(activeEl.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white resize-y min-h-24 outline-none focus:border-teal-500" placeholder="<mark>強調文字</mark>等を入力" />
                        </div>
                     )}

                     <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div className="space-y-3">
                           <div>
                              <label className="block text-neutral-400 mb-1 text-xs">フォント</label>
                              <select value={activeEl.textStyle.fontFamily} onChange={e => updateActiveElementStyle('fontFamily', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-1 text-xs text-white">
                                 <option value="'Noto Sans JP', sans-serif">Noto ゴシック (標準)</option>
                                 <option value="'Zen Kaku Gothic New', sans-serif">Zen 角ゴシック (力強い)</option>
                                 <option value="'Zen Old Mincho', serif">Zen オールド明朝 (高級・上品)</option>
                                 <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded (丸ゴシック)</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-neutral-400 mb-1 text-xs">文字色</label>
                              <input type="color" value={activeEl.textStyle.color} onChange={e => updateActiveElementStyle('color', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                           </div>
                           <div>
                              <div className="flex justify-between mb-1">
                                <label className="block text-neutral-400 text-xs">背景色</label>
                                <button onClick={() => updateActiveElementStyle('backgroundColor', 'transparent')} className="text-[10px] text-teal-400">透明化</button>
                              </div>
                              <input type="color" value={activeEl.textStyle.backgroundColor === 'transparent' ? '#000000' : activeEl.textStyle.backgroundColor} onChange={e => updateActiveElementStyle('backgroundColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                           </div>
                        </div>
                        <div className="space-y-3">
                           <div>
                              <label className="block text-neutral-400 mb-1 text-xs">アウトライン太さ</label>
                              <input type="range" min="0" max="10" value={activeEl.textStyle.textStrokeWidth || 0} onChange={e => updateActiveElementStyle('textStrokeWidth', parseInt(e.target.value))} className="w-full accent-teal-500" />
                           </div>
                           <div>
                              <label className="block text-neutral-400 mb-1 text-xs">アウトライン色</label>
                              <input type="color" value={activeEl.textStyle.textStrokeColor || '#000000'} onChange={e => updateActiveElementStyle('textStrokeColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                           </div>
                           <div>
                              <label className="block text-neutral-400 mb-1 text-xs">影</label>
                              <select value={activeEl.textStyle.textShadow || 'none'} onChange={e => updateActiveElementStyle('textShadow', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-1 text-xs text-white">
                                 <option value="none">なし</option>
                                 <option value="2px 2px 4px rgba(0,0,0,0.5)">軽い影 (シンプル)</option>
                                 <option value="4px 4px 8px rgba(0,0,0,0.8)">深い影 (強い浮き出し)</option>
                              </select>
                           </div>
                        </div>
                     </div>
                     <div>
                        <div className="flex justify-between mb-1">
                           <label className="block text-neutral-400 text-sm">フォントサイズ</label>
                           <span className="text-neutral-400 text-sm">{activeEl.textStyle.fontSize}px</span>
                        </div>
                        <input type="range" min="10" max="150" value={activeEl.textStyle.fontSize} onChange={e => updateActiveElementStyle('fontSize', parseInt(e.target.value))} className="w-full accent-teal-500" />
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={() => updateActiveElementStyle('fontWeight', activeEl.textStyle.fontWeight === '900' ? '400' : '900')} className={`p-1 text-sm border rounded ${activeEl.textStyle.fontWeight === '900' ? 'bg-neutral-700 border-neutral-500 text-white font-black' : 'border-neutral-700 text-neutral-400'}`}>太字</button>
                        <select value={activeEl.textStyle.textAlign} onChange={e => updateActiveElementStyle('textAlign', e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded p-1 text-sm">
                           <option value="left">左寄せ</option>
                           <option value="center">中央配置</option>
                           <option value="right">右寄せ</option>
                        </select>
                     </div>
                  </Card>
                )}

                {/* Actions */}
                <Card className="bg-neutral-800 border-neutral-700 p-4 space-y-4">
                   <h3 className="font-bold text-white flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-emerald-400" /> プレビュー切替</h3>
                   {SIZES.map(s => (
                     <button key={s.name} onClick={() => setCanvasSize(s)} className={`w-full p-2 text-sm rounded border ${canvasSize.name === s.name ? 'border-teal-500 bg-teal-900/30 text-teal-400' : 'border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-700'}`}>
                       {s.name}
                     </button>
                   ))}
                </Card>
                
                <button 
                    onClick={async () => {
                      if(!canvasRef.current) return;
                      setSelectedElementId(null);
                      setTimeout(async () => {
                        const canvas = await html2canvas(canvasRef.current!, { scale: 2, useCORS: true });
                        const link = document.createElement('a'); link.download = 'creative.png'; link.href = canvas.toDataURL(); link.click();
                      }, 100);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-lg flex items-center justify-center gap-2"
                >
                    <Download /> 高画質ダウンロード
                </button>
                <div className="flex gap-2">
                  <button onClick={handleSaveList} className="flex-1 bg-neutral-700 hover:bg-neutral-600 p-3 rounded text-sm text-white flex justify-center items-center gap-1"><Save className="w-4 h-4"/>保存</button>
                  <button onClick={handleSlackShare} className="flex-1 bg-[#4A154B] hover:bg-[#3E113F] p-3 rounded text-sm text-white flex justify-center items-center gap-1"><Share2 className="w-4 h-4"/>Slack追加</button>
                </div>
                <button onClick={() => setStep(3)} className="w-full bg-neutral-800 hover:bg-neutral-700 p-3 rounded text-sm">条件設定(Step3)へ戻る</button>
             </div>

             {/* Canvas Side */}
             <div className="lg:col-span-3 flex justify-center overflow-x-auto bg-neutral-950 p-8 rounded-2xl relative min-h-[800px] items-start">
               {(() => {
                 const scale = Math.min(800/canvasSize.h, 800/canvasSize.w);
                 return (
                  <div style={{ width: canvasSize.w * scale, height: canvasSize.h * scale, position: 'relative' }}>
                    <div 
                       ref={canvasRef}
                       className="relative bg-white overflow-hidden shadow-2xl transition-all duration-500"
                       style={{
                         width: canvasSize.w, height: canvasSize.h,
                         minWidth: canvasSize.w, minHeight: canvasSize.h,
                         transform: `scale(${scale})`, transformOrigin: 'top left',
                         border: 'none',
                         backgroundImage: generatedBg ? `url(${generatedBg})` : 'linear-gradient(to bottom right, #f8fafc, #e2e8f0)',
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
                             <div className={`border-2 group flex flex-col p-1 cursor-move transition-colors w-full h-full ${selectedElementId === el.id ? 'border-teal-500' : 'border-transparent hover:border-dashed hover:border-teal-500/50'}`}>
                                {el.type === 'cta' ? (
                                   <div className={`no-drag outline-none ${el.style}`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: `${el.textStyle.textStrokeWidth || 0}px ${el.textStyle.textStrokeColor || 'transparent'}`, color: el.textStyle.color, background: `linear-gradient(135deg, ${el.textStyle.backgroundColor}, #000)`, fontSize: `${el.textStyle.fontSize}px`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {el.content}
                                   </div>
                                ) : el.type === 'main' ? (
                                   <div className={`no-drag flex-grow outline-none ${el.style}`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: `${el.textStyle.textStrokeWidth || 0}px ${el.textStyle.textStrokeColor || 'transparent'}`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: `${el.textStyle.fontSize}px`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {renderRichText(el.content, activeDesignSpecs?.color_palette?.accent || '#38bdf8')}
                                   </div>
                                ) : el.type === 'shape' ? (
                                   <div className={el.style} style={el.id === 'bg-plate' ? { background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' } : { backgroundColor: el.textStyle.backgroundColor }} />
                                ) : el.type === 'image' ? (
                                    <img src={el.content} className={el.style} draggable={false} alt="素材" style={{ filter: el.composeMode === 'product-shadow' ? 'drop-shadow(0 30px 40px rgba(0,0,0,0.3)) drop-shadow(0 15px 15px rgba(0,0,0,0.6))' : 'none' }} />
                                ) : (
                                   <div className={`no-drag outline-none flex-grow ${el.style}`} style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: `${el.textStyle.textStrokeWidth || 0}px ${el.textStyle.textStrokeColor || 'transparent'}`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: `${el.textStyle.fontSize}px`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}>
                                      {el.content}
                                   </div>
                                )}
                             </div>
                          </Rnd>
                       ))}
                    </div>
                  </div>
                 );
               })()}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
