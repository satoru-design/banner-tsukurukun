// src/components/steps/Step3Editor.tsx
'use client';

import React from 'react';
import { Rnd } from 'react-rnd';
import { Card } from "@/components/ui/card";
import { Wand2, Download, LayoutTemplate, Type, Palette, Share2, Save, ImagePlus, User, MousePointerClick } from "lucide-react";
import html2canvas from "html2canvas";
import { CanvasElement, CanvasSize, SIZES, renderRichText } from '@/lib/banner-state';
import { ModelSelector } from './ModelSelector';

type DesignSpecs = {
  layout_id?: string;
  color_palette?: { accent?: string; main?: string };
  tone_and_manner?: string;
  image_gen_prompt?: string;
} | null;

type Props = {
  // which sub-step to render: 3 = conditions, 4 = editor canvas
  step: number;

  // Step 3 (conditions) props
  manualMainCopy: string;
  setManualMainCopy: (v: string) => void;
  manualSubCopy: string;
  setManualSubCopy: (v: string) => void;
  manualImagePrompt: string;
  setManualImagePrompt: (v: string) => void;
  hasPerson: 'yes' | 'no' | 'any';
  setHasPerson: (v: 'yes' | 'no' | 'any') => void;
  personAttr: string;
  setPersonAttr: (v: string) => void;
  hasProductImage: 'yes' | 'no';
  setHasProductImage: (v: 'yes' | 'no') => void;
  productImagesBase64: string[];
  hasLogo: 'yes' | 'no';
  setHasLogo: (v: 'yes' | 'no') => void;
  logosBase64: string[];
  hasCta: 'yes' | 'no';
  setHasCta: (v: 'yes' | 'no') => void;
  ctaText: string;
  setCtaText: (v: string) => void;
  bannerTone: string;
  setBannerTone: (v: string) => void;
  layoutStyle: 'left' | 'right' | 'center';
  setLayoutStyle: (v: 'left' | 'right' | 'center') => void;
  additionalInstructions: string;
  setAdditionalInstructions: (v: string) => void;
  onFileUploadForConditions: (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => void;
  setProductImagesBase64: React.Dispatch<React.SetStateAction<string[]>>;
  setLogosBase64: React.Dispatch<React.SetStateAction<string[]>>;
  onGenerateBg: () => void;
  onBackToStep2: () => void;

  // Step 4 (editor) props
  canvasSize: CanvasSize;
  setCanvasSize: (s: CanvasSize) => void;
  editorTexts: CanvasElement[];
  setEditorTexts: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  generatedBg: string | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedElementId: string | null;
  setSelectedElementId: (v: string | null) => void;
  activeDesignSpecs: DesignSpecs;
  onUpdateText: (id: string, text: string) => void;
  onUpdateActiveElementStyle: (key: keyof CanvasElement['textStyle'], value: unknown) => void;
  onSaveList: () => void;
  onSlackShare: () => void;
  onBackToConditions: () => void;

  // Phase A5: Image model selection
  imageModel: 'imagen4' | 'flux';
  setImageModel: (v: 'imagen4' | 'flux') => void;
  lastProviderUsed: string | null;
  lastFallback: boolean;
};

export function Step3Editor(props: Props) {
  const {
    step,
    manualMainCopy, setManualMainCopy,
    manualSubCopy, setManualSubCopy,
    manualImagePrompt, setManualImagePrompt,
    hasPerson, setHasPerson,
    hasProductImage, setHasProductImage,
    productImagesBase64,
    hasLogo, setHasLogo,
    logosBase64,
    hasCta, setHasCta,
    ctaText, setCtaText,
    bannerTone, setBannerTone,
    layoutStyle, setLayoutStyle,
    additionalInstructions, setAdditionalInstructions,
    onFileUploadForConditions,
    setProductImagesBase64,
    setLogosBase64,
    onGenerateBg,
    onBackToStep2,
    canvasSize, setCanvasSize,
    editorTexts,
    generatedBg,
    canvasRef,
    selectedElementId, setSelectedElementId,
    activeDesignSpecs,
    onUpdateText,
    onUpdateActiveElementStyle,
    onSaveList,
    onSlackShare,
    onBackToConditions,
  } = props;

  const activeEl = editorTexts.find(e => e.id === selectedElementId);

  if (step === 3) {
    return (
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
                    <input type="file" id="prod-upload" accept="image/*" multiple onChange={(e)=>onFileUploadForConditions(e, setProductImagesBase64)} disabled={hasProductImage==='no'} className="hidden" />
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
                    <input type="file" id="logo-upload" accept="image/*" multiple onChange={(e)=>onFileUploadForConditions(e, setLogosBase64)} disabled={hasLogo==='no'} className="hidden" />
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
                       <select value={layoutStyle} onChange={e=>setLayoutStyle(e.target.value as 'left' | 'right' | 'center')} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white focus:border-teal-500">
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

        <div className="mb-3">
          <div className="text-xs text-slate-400 mb-1">画像生成モデル</div>
          <ModelSelector
            value={props.imageModel}
            onChange={props.setImageModel}
            disabled={false}
          />
          {props.lastProviderUsed && props.lastFallback && (
            <div className="mt-1 text-xs text-amber-400">
              ※ {props.imageModel} 失敗のため {props.lastProviderUsed} にフォールバック
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4">
           <button onClick={onBackToStep2} className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-bold">Step 2に戻る</button>
           <button onClick={onGenerateBg} className="px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-90 rounded-xl text-white font-black text-lg shadow-lg hover:scale-105 transition-transform"><Wand2 className="inline mr-2"/> 背景画像を生成してエディタへ</button>
        </div>
      </div>
    );
  }

  // step === 4 : Editor Canvas
  return (
    <div className="grid lg:grid-cols-4 gap-8">
       <div className="space-y-6">

          {/* Properties Panel */}
          {activeEl && activeEl.type !== 'image' && (
            <Card className="bg-neutral-800 border-teal-500 p-4 space-y-4 shadow-lg shadow-teal-900/20">
               <h3 className="font-bold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-teal-400" /> 文字スタイル編集</h3>

               {['main', 'sub', 'cta'].includes(activeEl.type) && (
                  <div className="mt-4 pt-2 border-t border-teal-500/30">
                     <label className="block text-neutral-400 mb-1 text-xs">テキスト内容 (リッチテキスト編集)</label>
                     <textarea value={activeEl.content} onChange={e => onUpdateText(activeEl.id, e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white resize-y min-h-24 outline-none focus:border-teal-500" placeholder="<mark>強調文字</mark>等を入力" />
                  </div>
               )}

               <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                  <div className="space-y-3">
                     <div>
                        <label className="block text-neutral-400 mb-1 text-xs">フォント</label>
                        <select value={activeEl.textStyle.fontFamily} onChange={e => onUpdateActiveElementStyle('fontFamily', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-1 text-xs text-white">
                           <option value="'Noto Sans JP', sans-serif">Noto ゴシック (標準)</option>
                           <option value="'Zen Kaku Gothic New', sans-serif">Zen 角ゴシック (力強い)</option>
                           <option value="'Zen Old Mincho', serif">Zen オールド明朝 (高級・上品)</option>
                           <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded (丸ゴシック)</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-neutral-400 mb-1 text-xs">文字色</label>
                        <input type="color" value={activeEl.textStyle.color} onChange={e => onUpdateActiveElementStyle('color', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                     </div>
                     <div>
                        <div className="flex justify-between mb-1">
                          <label className="block text-neutral-400 text-xs">背景色</label>
                          <button onClick={() => onUpdateActiveElementStyle('backgroundColor', 'transparent')} className="text-[10px] text-teal-400">透明化</button>
                        </div>
                        <input type="color" value={activeEl.textStyle.backgroundColor === 'transparent' ? '#000000' : activeEl.textStyle.backgroundColor} onChange={e => onUpdateActiveElementStyle('backgroundColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                     </div>
                  </div>
                  <div className="space-y-3">
                     <div>
                        <label className="block text-neutral-400 mb-1 text-xs">アウトライン太さ</label>
                        <input type="range" min="0" max="10" value={activeEl.textStyle.textStrokeWidth || 0} onChange={e => onUpdateActiveElementStyle('textStrokeWidth', parseInt(e.target.value))} className="w-full accent-teal-500" />
                     </div>
                     <div>
                        <label className="block text-neutral-400 mb-1 text-xs">アウトライン色</label>
                        <input type="color" value={activeEl.textStyle.textStrokeColor || '#000000'} onChange={e => onUpdateActiveElementStyle('textStrokeColor', e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                     </div>
                     <div>
                        <label className="block text-neutral-400 mb-1 text-xs">影</label>
                        <select value={activeEl.textStyle.textShadow || 'none'} onChange={e => onUpdateActiveElementStyle('textShadow', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-1 text-xs text-white">
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
                  <input type="range" min="10" max="150" value={activeEl.textStyle.fontSize} onChange={e => onUpdateActiveElementStyle('fontSize', parseInt(e.target.value))} className="w-full accent-teal-500" />
               </div>
               <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => onUpdateActiveElementStyle('fontWeight', activeEl.textStyle.fontWeight === '900' ? '400' : '900')} className={`p-1 text-sm border rounded ${activeEl.textStyle.fontWeight === '900' ? 'bg-neutral-700 border-neutral-500 text-white font-black' : 'border-neutral-700 text-neutral-400'}`}>太字</button>
                  <select value={activeEl.textStyle.textAlign} onChange={e => onUpdateActiveElementStyle('textAlign', e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded p-1 text-sm">
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
            <button onClick={onSaveList} className="flex-1 bg-neutral-700 hover:bg-neutral-600 p-3 rounded text-sm text-white flex justify-center items-center gap-1"><Save className="w-4 h-4"/>保存</button>
            <button onClick={onSlackShare} className="flex-1 bg-[#4A154B] hover:bg-[#3E113F] p-3 rounded text-sm text-white flex justify-center items-center gap-1"><Share2 className="w-4 h-4"/>Slack追加</button>
          </div>
          <button onClick={onBackToConditions} className="w-full bg-neutral-800 hover:bg-neutral-700 p-3 rounded text-sm">条件設定(Step3)へ戻る</button>
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
                       key={el.id} default={{ x: el.defaultPos.x, y: el.defaultPos.y, width: (el.defaultPos as { w?: number | string; width?: number | string }).w || (el.defaultPos as { w?: number | string; width?: number | string }).width || 0, height: (el.defaultPos as { h?: number | string; height?: number | string }).h || (el.defaultPos as { h?: number | string; height?: number | string }).height || 0 }} bounds="parent" cancel=".no-drag"
                       onDragStart={() => setSelectedElementId(el.id)}
                       onClickCapture={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedElementId(el.id); }}
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
  );
}
