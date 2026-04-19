'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Copy, Wand2, Download, Image as ImageIcon, LayoutTemplate, ScanEye, Zap, Scaling, Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import html2canvas from "html2canvas";

type CanvasSize = { w: number, h: number, name: string };
const SIZES: CanvasSize[] = [
  { name: 'Instagram (1080x1080)', w: 1080, h: 1080 },
  { name: 'FB/GDN (1200x628)', w: 1200, h: 628 },
  { name: 'Stories (1080x1920)', w: 1080, h: 1920 },
];

export default function BannerBuilder() {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  // Input State
  const [inputMode, setInputMode] = useState<'lp' | 'image'>('lp');
  const [url, setUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [target, setTarget] = useState('');
  const [insightData, setInsightData] = useState<any>(null); // from Gemini
  
  // Generation State
  const [variations, setVariations] = useState<any[]>([]);
  const [activeAngleIdx, setActiveAngleIdx] = useState(0);
  const [bgImages, setBgImages] = useState<string[]>([]);
  
  // Editor State
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(SIZES[0]);
  const [showBorder, setShowBorder] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- API Handlers ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setLoading(true); setLoadingMsg("Gemini 1.5 Proがバナー画像を解析中...");
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
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setLoading(true); setLoadingMsg("Claude 3.5 Sonnetが4つの訴求軸で戦略を構築中...");
    try {
      const insightsStr = insightData ? JSON.stringify(insightData) : '';
      const res = await fetch('/api/generate-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, productName, target, competitorInsights: insightsStr })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setVariations(data.variations);
      setBgImages(new Array(data.variations.length).fill(null));
      setStep(2);
    } catch (err: any) {
      alert("生成エラー: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBg = async (index: number) => {
    const v = variations[index];
    if (!v || !v.imagePrompt) return;
    setLoading(true); setLoadingMsg(`Flux.1が「${v.angle}」の背景画像を生成中...`);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: v.imagePrompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newImages = [...bgImages];
      newImages[index] = data.imageUrl;
      setBgImages(newImages);
    } catch (err: any) { alert("画像生成エラー: " + err.message); }
    setLoading(false);
  };

  const currentVar = variations[activeAngleIdx] || {};

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-neutral-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-600 flex items-center gap-2">
              <Zap className="text-emerald-500 w-8 h-8" />
              Creative Agency AI (Enterprise)
            </h1>
            <p className="text-neutral-400 mt-1">Claude 3.5 + Gemini 1.5 + Flux.1 多角戦略自動生成システム</p>
          </div>
          <div className="flex gap-4 text-sm font-semibold">
             <span className={step >= 1 ? 'text-teal-400' : 'text-neutral-600'}>1. 解析</span>
             <span className={step >= 2 ? 'text-teal-400' : 'text-neutral-600'}>2. 4軸生成</span>
             <span className={step >= 3 ? 'text-teal-400' : 'text-neutral-600'}>3. エディタ</span>
          </div>
        </header>

        {loading && (
          <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xl font-bold text-teal-400 animate-pulse">{loadingMsg}</p>
          </div>
        )}

        {/* Step 1: Input & Analyze */}
        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-neutral-800 border-neutral-700">
              <CardHeader>
                <div className="flex space-x-4 mb-4 border-b border-neutral-700 pb-2">
                  <button onClick={() => setInputMode('lp')} className={`pb-2 font-bold ${inputMode === 'lp' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-neutral-500'}`}>LPスクレイピング (Jina)</button>
                  <button onClick={() => setInputMode('image')} className={`pb-2 font-bold ${inputMode === 'image' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-neutral-500'}`}>バナー視覚解析 (Gemini Vision)</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {inputMode === 'lp' && (
                  <>
                    <input className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded text-white" placeholder="LPのURL (例: https://...)" value={url} onChange={e => setUrl(e.target.value)} />
                    <input className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded text-white" placeholder="商品名" value={productName} onChange={e => setProductName(e.target.value)} />
                    <input className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded text-white" placeholder="ターゲット層" value={target} onChange={e => setTarget(e.target.value)} />
                  </>
                )}
                {inputMode === 'image' && (
                   <div className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center text-neutral-400 hover:border-teal-500 transition-colors">
                     <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                     <p>過去の効果バナーや競合画像をアップロード</p>
                     <input type="file" className="hidden" id="banner-up" onChange={handleImageUpload} />
                     <label htmlFor="banner-up" className="mt-4 inline-block bg-neutral-700 px-4 py-2 rounded cursor-pointer hover:bg-neutral-600 text-white">ファイルを選択</label>
                   </div>
                )}
              </CardContent>
              <CardFooter>
                 <button onClick={handleGenerate} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold p-4 rounded-lg flex justify-center items-center gap-2">
                   <Wand2 /> Claude 3.5 に多角戦略コンテキストを生成させる
                 </button>
              </CardFooter>
            </Card>

            {/* Insight Display */}
            <Card className="bg-neutral-800 border-neutral-700">
               <CardHeader><CardTitle className="text-neutral-300">Gemini 1.5 Pro 解析インサイト</CardTitle></CardHeader>
               <CardContent>
                 {insightData ? (
                   <div className="space-y-3 text-sm">
                     <div><span className="font-bold text-teal-400">主要感情:</span> {insightData.dominant_emotion}</div>
                     <div><span className="font-bold text-teal-400">メイン訴求:</span> {insightData.main_appeal}</div>
                     <div><span className="font-bold text-teal-400">カウンター戦略:</span> {insightData.counter_strategy}</div>
                   </div>
                 ) : (
                   <div className="h-full flex items-center justify-center text-neutral-600">画像アップロード待ち</div>
                 )}
               </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Generation Preview */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
               <Wand2 className="text-teal-400" />
               Claude 3.5 考案: 4つのマーケティングアングル
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {variations.map((v, i) => (
                <div key={i} onClick={() => setActiveAngleIdx(i)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${activeAngleIdx === i ? 'border-teal-500 bg-neutral-800' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-900'}`}>
                  <h3 className="font-black text-lg text-emerald-400 mb-2 uppercase">{v.angle}</h3>
                  <p className="font-bold text-white mb-2">{v.mainCopy}</p>
                  <p className="text-sm text-neutral-400">{v.subCopy}</p>
                </div>
              ))}
            </div>

            <Card className="bg-neutral-800 border-neutral-700">
              <CardContent className="p-6">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xl font-bold">{currentVar.angle} アングルの背景画像生成 (Flux.1)</h3>
                   {bgImages[activeAngleIdx] ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><ScanEye /> 生成完了</span>
                   ) : (
                      <button onClick={() => handleGenerateBg(activeAngleIdx)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-bold flex items-center gap-2">
                        Replicateで生成する
                      </button>
                   )}
                 </div>
                 <p className="text-sm text-neutral-400 mb-4 bg-neutral-900 p-3 rounded">Prompt: {currentVar.imagePrompt}</p>
                 {bgImages[activeAngleIdx] && (
                    <img src={bgImages[activeAngleIdx]} alt="Generated BG" className="w-full max-w-sm rounded-lg shadow-xl" />
                 )}
              </CardContent>
              <CardFooter>
                 <button onClick={() => setStep(3)} className="w-full bg-teal-600 hover:bg-teal-500 font-bold p-4 rounded-lg">
                   エディタフェーズへ移行 (Edit & Export)
                 </button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Step 3: Editor Canvas */}
        {step === 3 && (
          <div className="grid lg:grid-cols-4 gap-8">
             {/* Tools Side */}
             <div className="space-y-6">
                <Card className="bg-neutral-800 border-neutral-700 p-4 space-y-4">
                   <h3 className="font-bold text-white flex items-center gap-2"><Scaling className="w-4 h-4 text-teal-400" /> プラットフォーム切替</h3>
                   {SIZES.map(s => (
                     <button key={s.name} onClick={() => setCanvasSize(s)} className={`w-full p-2 text-sm rounded border ${canvasSize.name === s.name ? 'border-teal-500 bg-teal-900/30 text-teal-400' : 'border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-700'}`}>
                       {s.name}
                     </button>
                   ))}
                   
                   <hr className="border-neutral-700 my-4" />
                   
                   <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                     <input type="checkbox" checked={showBorder} onChange={e => setShowBorder(e.target.checked)} className="form-checkbox text-teal-500" />
                     1pxの外枠を付与する (広告規定対応)
                   </label>
                   
                   <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-yellow-500">
                     <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} className="form-checkbox" />
                     AI視線解析(ヒートマップ)プレビュー
                   </label>
                </Card>
                
                <button 
                    onClick={async () => {
                      if(!canvasRef.current) return;
                      const canvas = await html2canvas(canvasRef.current, { scale: 2, useCORS: true });
                      const link = document.createElement('a'); link.download = 'creative.png'; link.href = canvas.toDataURL(); link.click();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-lg flex items-center justify-center gap-2"
                >
                    <Download /> 高画質ダウンロード
                </button>
                <button onClick={() => setStep(2)} className="w-full bg-neutral-700 hover:bg-neutral-600 p-3 rounded text-sm">戻る</button>
             </div>

             {/* Canvas Side */}
             <div className="lg:col-span-3 flex justify-center overflow-x-auto bg-neutral-950 p-8 rounded-2xl relative min-h-[800px]">
                <div 
                   ref={canvasRef}
                   className="relative bg-white overflow-hidden shadow-2xl transition-all duration-500"
                   style={{
                     width: canvasSize.w,
                     height: canvasSize.h,
                     transform: `scale(${Math.min(800/canvasSize.h, 800/canvasSize.w)})`,
                     transformOrigin: 'top center',
                     border: showBorder ? '1px solid #e5e5e5' : 'none',
                     backgroundImage: bgImages[activeAngleIdx] ? `url(${bgImages[activeAngleIdx]})` : 'linear-gradient(to bottom right, #f8fafc, #e2e8f0)',
                     backgroundSize: 'cover',
                     backgroundPosition: 'center',
                   }}
                >
                   {/* Heatmap Overlay (Mocked logic for display) */}
                   {showHeatmap && (
                     <div className="absolute inset-0 z-40 bg-black/60 pointer-events-none mix-blend-color" style={{
                       backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(255,0,0,0.8) 0%, rgba(255,255,0,0.4) 30%, transparent 60%)'
                     }} />
                   )}
                   
                   <Rnd default={{ x: canvasSize.w*0.1, y: canvasSize.h*0.1, width: canvasSize.w*0.8, height: 'auto' }} bounds="parent">
                      <div className="border border-dashed border-transparent hover:border-teal-500 p-2 cursor-move group">
                         <h2 className="text-white bg-black/80 p-4 rounded-xl font-black text-6xl leading-tight inline-block filter drop-shadow-lg" style={{ whiteSpace: 'pre-wrap' }}>
                           {currentVar.mainCopy}
                         </h2>
                      </div>
                   </Rnd>
                   
                   <Rnd default={{ x: canvasSize.w*0.1, y: canvasSize.h*0.4, width: canvasSize.w*0.8, height: 'auto' }} bounds="parent">
                      <div className="border border-dashed border-transparent hover:border-emerald-500 p-2 cursor-move group">
                         <p className="text-black bg-white/90 px-6 py-3 rounded-full font-bold text-3xl inline-block shadow-xl break-words whitespace-pre-wrap">
                           {currentVar.subCopy}
                         </p>
                      </div>
                   </Rnd>

                   <Rnd default={{ x: canvasSize.w*0.2, y: canvasSize.h*0.8, width: canvasSize.w*0.6, height: 100 }} bounds="parent">
                      <div className="w-full h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-2xl cursor-move hover:scale-105 transition-transform">
                         今すぐ詳細を見る
                      </div>
                   </Rnd>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
