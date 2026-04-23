'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Zap, History } from "lucide-react";
import html2canvas from "html2canvas";
import {
  CanvasSize,
  CanvasElement,
  SIZES,
  readAsBase64,
  validateAndFixMarkTag,
  computeDefaultBadgePosition,
  resolveSecondaryBadgePosition,
  autoSelectCta,
  type Variation,
  type ProductCategory,
} from "@/lib/banner-state";
import { Step1Input } from "@/components/steps/Step1Input";
import { Step2Angles } from "@/components/steps/Step2Angles";
import { Step3Editor } from "@/components/steps/Step3Editor";
import { StyleProfileSelector } from "@/components/steps/StyleProfileSelector";
import { StyleProfileEditor } from "@/components/style/StyleProfileEditor";
import type { StyleProfile } from "@/lib/style-profile/schema";
import type { ImageProviderId } from "@/lib/image-providers/types";
import type { PriceBadge, CtaTemplateId, AngleId } from '@/lib/banner-state';
import { ANGLE_KEYWORDS, PROVIDER_PREFIX, AD_COMMON_PREFIX } from '@/lib/prompts/angle-keywords';

type InsightData = {
  inferred_product_name?: string;
  inferred_target_demographic?: string;
  main_appeal?: string;
  worldview?: string;
  productCategory?: ProductCategory;
} | null;

type SavedBanner = Record<string, unknown>;

export default function BannerBuilder() {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const [showDashboard, setShowDashboard] = useState(false);
  const [savedBanners, setSavedBanners] = useState<SavedBanner[]>([]);

  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string | null>(null);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [activeStyleProfile, setActiveStyleProfile] = useState<StyleProfile | null>(null);
  // Phase A.7: Bake main/sub/cta/badge text directly into the generated image (ChatGPT Web style).
  // When true, HTML overlays are hidden in Step3Editor to avoid double-rendering.
  const [bakeTextIntoImage, setBakeTextIntoImage] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedStyleProfileId) {
      setActiveStyleProfile(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/style-profile/${selectedStyleProfileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && !data.error) setActiveStyleProfile(data as StyleProfile);
      })
      .catch(() => {
        if (!cancelled) setActiveStyleProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStyleProfileId]);

  // ---- Step 1: Input State ----
  const [inputMode, setInputMode] = useState<'lp' | 'image'>('lp');
  const [url, setUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [target, setTarget] = useState('');
  const [insightData, setInsightData] = useState<InsightData>(null);
  const [lpRawText, setLpRawText] = useState<string>('');

  // ---- Step 2: Generation State ----
  const [variations, setVariations] = useState<Variation[]>([]);
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
  const [activeDesignSpecs, setActiveDesignSpecs] = useState<Variation['design_specs'] | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // ---- Phase A5: Image Model Selection (declared early for useEffect deps) ----
  const [imageModel, setImageModel] = useState<ImageProviderId>('imagen4');
  const [lastProviderUsed, setLastProviderUsed] = useState<ImageProviderId | null>(null);
  const [lastFallback, setLastFallback] = useState<boolean>(false);

  // ---- Phase A5: Active Angle ID (for image prompt construction) ----
  const [activeAngleId, setActiveAngleId] = useState<AngleId>('benefit');


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

    const angleKeywords = ANGLE_KEYWORDS[activeAngleId] ?? '';
    const providerPrefix = PROVIDER_PREFIX[imageModel] ?? '';

    const finalMegaPrompt = [
      AD_COMMON_PREFIX,
      providerPrefix,
      angleKeywords,
      layoutInstruction,
      personConstraint,
      toneConstraint,
      `-- Core Visual Description --\n${baseImagePrompt}`,
      `-- Technical Specs --\n4k, highly detailed, photorealistic, professional lighting, no text, no watermarks, flawless aesthetic.`,
      userAdditions,
    ].filter(Boolean).join('\n\n');

    setManualImagePrompt(finalMegaPrompt);
  }, [layoutStyle, bannerTone, hasPerson, personAttr, additionalInstructions, baseImagePrompt, step, activeAngleId, imageModel]);

  // ---- Step 4: Editor State ----
  const [generatedBg, setGeneratedBg] = useState<string|null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(SIZES[0]);
  const [editorTexts, setEditorTexts] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewScale, setViewScale] = useState(1);

  // ---- Phase A5: Price Badge & CTA ----
  const [activeBadge, setActiveBadge] = useState<PriceBadge | null>(null);
  const [activeSecondaryBadge, setActiveSecondaryBadge] = useState<PriceBadge | null>(null);
  const [activeCtaTemplateId, setActiveCtaTemplateId] = useState<CtaTemplateId>('cta-orange-arrow');
  const [activeCtaText, setActiveCtaText] = useState<string>('');

  // ---- Phase A5: Jump rate (emphasis ratio) ----
  const [activeEmphasisRatio, setActiveEmphasisRatio] = useState<'2x' | '3x'>('2x');

  // ---- Phase A5: Urgency (for CTA pulse) ----
  const [activeUrgency, setActiveUrgency] = useState<'low' | 'high'>('low');

  // ---- Phase A5: html2canvas capture flag (disables CSS animation) ----
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

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
    setIsCapturing(true);
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
               elements: editorTexts, base64Image: b64, angle: v?.strategy?.angle || 'Manual',
               imageModel: lastProviderUsed ?? imageModel,
               // Phase A.5
               angleId: activeAngleId,
               priceBadge: activeBadge,
               ctaTemplateId: activeCtaTemplateId,
               ctaText: activeCtaText,
               emphasisRatio: activeEmphasisRatio,
               urgency: activeUrgency,
               // Phase A.6
               styleProfileId: selectedStyleProfileId,
           })
       });
       if(res.ok) alert("マイリストに保存されました！");
    } finally {
      setIsCapturing(false);
      setLoading(false);
    }
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
    } catch (err: unknown) {
      alert("LP解析エラー: " + (err instanceof Error ? err.message : String(err)));
    }
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
    } catch (err: unknown) {
      alert("解析エラー: " + (err instanceof Error ? err.message : String(err)));
    }
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
        body: JSON.stringify({ productName, target, competitorInsights: insightsStr, lpText: lpRawText, styleProfileId: selectedStyleProfileId })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Phase A5: validate & fix <mark> tags in main_copy for each variation
      const cleaned = (data.variations ?? []).map((v: Variation) => ({
        ...v,
        copy: {
          ...v.copy,
          main_copy: validateAndFixMarkTag(v.copy?.main_copy ?? ''),
        },
      }));
      if (Array.isArray(data.variations) && data.variations.length < 8) {
        console.warn(`Gemini returned only ${data.variations.length} angles (expected 8). UI may show gaps.`);
      }
      setVariations(cleaned);
      setStep(2);
    } catch (err: unknown) {
      alert("生成エラー: " + (err instanceof Error ? err.message : String(err)));
    }
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
    setActiveDesignSpecs(v.design_specs ?? null);

    let nextLayoutStyle: 'left' | 'right' | 'center' = layoutStyle;
    if (v.design_specs && v.design_specs.layout_id) {
       const lid = v.design_specs.layout_id;
       nextLayoutStyle = lid === 'center-focus' ? 'center' : 'left';
       setLayoutStyle(nextLayoutStyle);
    }

    // Phase A5: Resolve angle + urgency + productCategory
    const angle: AngleId = v.strategy?.angle_id ?? 'benefit';
    setActiveAngleId(angle);

    const urgency = v.urgency ?? 'low';
    setActiveUrgency(urgency);

    const productCategory: ProductCategory = insightData?.productCategory ?? 'ec-general';

    // Phase A.6: If a StyleProfile is active, override badge/CTA/emphasisRatio with profile defaults
    if (activeStyleProfile) {
      const pb = activeStyleProfile.priceBadge.primary;
      const emphasisNumber = v.priceBadge?.emphasisNumber;
      const primaryPosition: PriceBadge['position'] =
        (pb.position as PriceBadge['position']) ??
        computeDefaultBadgePosition(nextLayoutStyle, hasPerson === 'yes', angle);
      setActiveBadge({
        text: pb.textPattern.replace('{NUMBER}', String(emphasisNumber ?? '980')),
        shape: (pb.shape as PriceBadge['shape']),
        color: pb.color,
        position: primaryPosition,
        emphasisNumber,
      });

      if (activeStyleProfile.priceBadge.secondary) {
        const sb = activeStyleProfile.priceBadge.secondary;
        setActiveSecondaryBadge({
          text: sb.textPattern.replace('{NUMBER}', '3,000 万'),
          shape: 'circle-gold',
          color: sb.color,
          position: resolveSecondaryBadgePosition(
            sb.position as PriceBadge['position'] | undefined,
            primaryPosition,
          ),
        });
      } else {
        setActiveSecondaryBadge(null);
      }

      setActiveCtaTemplateId(activeStyleProfile.cta.templateId);
      // Phase A.6: {ACTION} を商材名 or 既存CTAの動詞部分で置換。既存CTAが完全文の場合はそちらを優先。
      const ctaPattern = activeStyleProfile.cta.textPattern;
      const existingCta = v.ctaTemplate?.text ?? '';
      let finalCta: string;
      if (ctaPattern.includes('{ACTION}')) {
        const actionWord = (productName || 'デトックス').trim();
        finalCta = ctaPattern.replace('{ACTION}', actionWord);
      } else {
        finalCta = ctaPattern || existingCta || '今すぐ購入';
      }
      setActiveCtaText(finalCta);

      const profileRatio = activeStyleProfile.typography.mainCopyStyle.emphasisRatio;
      setActiveEmphasisRatio(profileRatio === '4x' ? '3x' : (profileRatio as '2x' | '3x'));
    } else {
      // Phase A5: PriceBadge - supply default position when Gemini omits it
      const rawBadge = v.priceBadge ?? null;
      const badge: PriceBadge | null = rawBadge
        ? {
            ...rawBadge,
            position:
              rawBadge.position ??
              computeDefaultBadgePosition(nextLayoutStyle, hasPerson === 'yes', angle),
          }
        : null;
      setActiveBadge(badge);
      setActiveSecondaryBadge(null);

      // Phase A5: CTA template - fallback to category x urgency matrix when missing
      const ctaId: CtaTemplateId = v.ctaTemplate?.id ?? autoSelectCta(productCategory, urgency);
      setActiveCtaTemplateId(ctaId);
      setActiveCtaText(v.ctaTemplate?.text ?? '今すぐ購入');

      setActiveEmphasisRatio(v.copy?.emphasis_ratio ?? '2x');
    }

    setStep(3);
  };

  const handleGenerateBg = async () => {
    const masterPrompt = manualImagePrompt;
    const aspectRatio: '1:1' | '16:9' | '9:16' =
      canvasSize.w === canvasSize.h
        ? '1:1'
        : canvasSize.w > canvasSize.h
          ? '16:9'
          : '9:16';

    setLoading(true); setLoadingMsg(`AI(${imageModel})が背景画像を生成中...`);
    try {
      const copyBundle = bakeTextIntoImage
        ? {
            mainCopy: manualMainCopy || undefined,
            subCopy: manualSubCopy || undefined,
            ctaText: activeCtaText || undefined,
            primaryBadgeText: activeBadge?.text || undefined,
            secondaryBadgeText: activeSecondaryBadge?.text || undefined,
          }
        : undefined;

      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: masterPrompt,
          provider: imageModel,
          aspectRatio,
          styleProfileId: selectedStyleProfileId,
          copyBundle,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratedBg(data.imageUrl);
      setLastProviderUsed(data.provider);
      setLastFallback(Boolean(data.fallback));
      enterEditor(data.imageUrl);
    } catch (err: unknown) {
      alert("画像生成エラー: " + (err instanceof Error ? err.message : String(err)));
    }
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
    const mainColor = activeDesignSpecs?.color_palette?.main || "#ffffff";

    const initialElements: CanvasElement[] = [];

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

    // Phase A.5: legacy Rnd-based CTA removed. CTA is rendered via <CtaButton> overlay in Step3Editor.

    logosBase64.forEach((logo, i) => {
        initialElements.push({
            id: 'logo-' + i, type: 'image', content: logo, style: "w-full h-full object-contain drop-shadow-md", textStyle: { color: '', backgroundColor: '', fontSize: 0, fontWeight: 'normal', textAlign: 'left' },
            defaultPos: layoutId === 'z-pattern' ? { x: 40, y: 40, w: 200, h: 60 } : { x: tx, y: 40 + (i*70), w: 150, h: 50 }
        });
    });

    productImagesBase64.forEach((img, i) => {
        initialElements.push({
            id: 'product-' + i, type: 'image', content: img, style: "w-full h-full object-contain", textStyle: { color: '', backgroundColor: '', fontSize: 0, fontWeight: 'normal', textAlign: 'left' }, composeMode: 'product-shadow',
            defaultPos: { x: layoutId === 'split-screen' ? canvasSize.w * 0.45 + (i*80) : canvasSize.w * 0.05 + (i*80), y: canvasSize.h * 0.2, w: canvasSize.w * 0.5, h: canvasSize.h * 0.7 }
        });
    });

    setEditorTexts(initialElements);
    setStep(4);
  };

  const updateText = (id: string, text: string) => {
    setEditorTexts(prev => prev.map(el => el.id === id ? { ...el, content: text } : el));
  };
  const updateActiveElementStyle = (key: keyof CanvasElement['textStyle'], value: unknown) => {
    if (!selectedElementId) return;
    setEditorTexts(prev => prev.map(el => el.id === selectedElementId ? { ...el, textStyle: { ...el.textStyle, [key]: value } } : el));
  };

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
          <div className="space-y-4">
            <StyleProfileSelector
              selectedId={selectedStyleProfileId}
              onSelect={setSelectedStyleProfileId}
              onCreateNew={() => setShowStyleEditor(true)}
            />
            <Step1Input
              inputMode={inputMode}
              setInputMode={setInputMode}
              url={url}
              setUrl={setUrl}
              productName={productName}
              setProductName={setProductName}
              target={target}
              setTarget={setTarget}
              insightData={insightData}
              onAnalyzeLp={handleAnalyzeLp}
              onImageUpload={handleImageUpload}
              onGenerateCopy={handleGenerateCopy}
            />
          </div>
        )}

        {showStyleEditor && (
          <StyleProfileEditor
            onClose={() => setShowStyleEditor(false)}
            onSaved={(id) => {
              setSelectedStyleProfileId(id);
              setShowStyleEditor(false);
            }}
          />
        )}

        {/* Step 2: Copy Selection */}
        {step === 2 && (
          <Step2Angles
            variations={variations}
            onSelectAngle={selectAngle}
            onBack={() => setStep(1)}
          />
        )}

        {/* Step 3: Banner Conditions Formulation & Step 4: Editor Canvas */}
        {(step === 3 || step === 4) && (
          <Step3Editor
            step={step}
            manualMainCopy={manualMainCopy}
            setManualMainCopy={setManualMainCopy}
            manualSubCopy={manualSubCopy}
            setManualSubCopy={setManualSubCopy}
            manualImagePrompt={manualImagePrompt}
            setManualImagePrompt={setManualImagePrompt}
            hasPerson={hasPerson}
            setHasPerson={setHasPerson}
            personAttr={personAttr}
            setPersonAttr={setPersonAttr}
            hasProductImage={hasProductImage}
            setHasProductImage={setHasProductImage}
            productImagesBase64={productImagesBase64}
            setProductImagesBase64={setProductImagesBase64}
            hasLogo={hasLogo}
            setHasLogo={setHasLogo}
            logosBase64={logosBase64}
            setLogosBase64={setLogosBase64}
            hasCta={hasCta}
            setHasCta={setHasCta}
            ctaText={ctaText}
            setCtaText={setCtaText}
            bannerTone={bannerTone}
            setBannerTone={setBannerTone}
            layoutStyle={layoutStyle}
            setLayoutStyle={setLayoutStyle}
            additionalInstructions={additionalInstructions}
            setAdditionalInstructions={setAdditionalInstructions}
            onFileUploadForConditions={handleFileUploadForConditions}
            onGenerateBg={handleGenerateBg}
            onBackToStep2={() => setStep(2)}
            canvasSize={canvasSize}
            setCanvasSize={setCanvasSize}
            editorTexts={editorTexts}
            setEditorTexts={setEditorTexts}
            generatedBg={generatedBg}
            canvasRef={canvasRef}
            selectedElementId={selectedElementId}
            setSelectedElementId={setSelectedElementId}
            activeDesignSpecs={activeDesignSpecs ?? null}
            onUpdateText={updateText}
            onUpdateActiveElementStyle={updateActiveElementStyle}
            onSaveList={handleSaveList}
            onSlackShare={handleSlackShare}
            onBackToConditions={() => setStep(3)}
            imageModel={imageModel}
            setImageModel={setImageModel}
            lastProviderUsed={lastProviderUsed}
            lastFallback={lastFallback}
            activeBadge={activeBadge}
            setActiveBadge={setActiveBadge}
            activeSecondaryBadge={activeSecondaryBadge}
            bakeTextIntoImage={bakeTextIntoImage}
            setBakeTextIntoImage={setBakeTextIntoImage}
            activeCtaTemplateId={activeCtaTemplateId}
            setActiveCtaTemplateId={setActiveCtaTemplateId}
            activeCtaText={activeCtaText}
            setActiveCtaText={setActiveCtaText}
            activeEmphasisRatio={activeEmphasisRatio}
            activeUrgency={activeUrgency}
            isCapturing={isCapturing}
            setIsCapturing={setIsCapturing}
          />
        )}
      </div>
    </div>
  );
}
