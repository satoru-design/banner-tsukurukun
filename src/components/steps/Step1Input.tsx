// src/components/steps/Step1Input.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Wand2, Image as ImageIcon, ScanEye } from "lucide-react";

type InsightData = {
  inferred_product_name?: string;
  inferred_target_demographic?: string;
  main_appeal?: string;
  worldview?: string;
} | null;

type Props = {
  inputMode: 'lp' | 'image';
  setInputMode: (v: 'lp' | 'image') => void;
  url: string;
  setUrl: (v: string) => void;
  productName: string;
  setProductName: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
  insightData: InsightData;
  onAnalyzeLp: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateCopy: () => void;
};

export function Step1Input(props: Props) {
  const {
    inputMode, setInputMode,
    url, setUrl,
    productName, setProductName,
    target, setTarget,
    insightData,
    onAnalyzeLp,
    onImageUpload,
    onGenerateCopy,
  } = props;

  return (
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
                      <button onClick={onAnalyzeLp} className="bg-teal-600 hover:bg-teal-500 text-white px-4 font-bold rounded shadow-lg whitespace-nowrap text-sm flex items-center gap-1"><ScanEye className="w-4 h-4"/> 解析</button>
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
                      <input type="file" accept="image/*" onChange={onImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <ImageIcon className="mx-auto h-12 w-12 text-neutral-500 mb-3" />
                      <p className="text-sm text-neutral-400 font-bold">クリックまたはドラッグ＆ドロップで画像をアップロード</p>
                      <p className="text-xs text-neutral-500 mt-2">AIが画像を解析し、訴求力のある新コピーを生成します</p>
                   </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-neutral-800 border-t border-neutral-700 mt-4">
              <button onClick={onGenerateCopy} className="w-full py-4 rounded-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg text-lg flex justify-center items-center gap-2"><Wand2 /> AIで4つの戦略を生成する</button>
            </CardFooter>
          </Card>

          <Card className="bg-neutral-800 border-neutral-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Gemini 分析インサイト</CardTitle>
              <CardDescription className="text-neutral-400">画像アップロード時に抽出された分析結果</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {insightData ? (
                <div className="space-y-4 bg-neutral-900 p-4 rounded border border-neutral-700 text-white leading-relaxed">
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
  );
}
