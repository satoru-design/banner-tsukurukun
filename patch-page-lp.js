const fs = require('fs');

let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add lpRawText state
const stateTarget = `const [insightData, setInsightData] = useState<any>(null);`;
const stateNew = `const [insightData, setInsightData] = useState<any>(null);\n  const [lpRawText, setLpRawText] = useState<string>('');`;
code = code.replace(stateTarget, stateNew);

// 2. Add handleAnalyzeLp
const analyzeFuncTarget = `  const handleImageUpload = async`;
const analyzeFuncNew = `  const handleAnalyzeLp = async () => {
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

  const handleImageUpload = async`;
code = code.replace(analyzeFuncTarget, analyzeFuncNew);

// 3. Update handleGenerateCopy payload
const generatePayloadTarget = `body: JSON.stringify({ url, productName, target, competitorInsights: insightsStr })`;
const generatePayloadNew = `body: JSON.stringify({ productName, target, competitorInsights: insightsStr, lpText: lpRawText })`;
code = code.replace(generatePayloadTarget, generatePayloadNew);

// 4. Update the LP UI with the Analyze button
const uiTarget = `<div>
                          <label className="text-xs text-neutral-400 font-bold mb-1 block">商材LPのURL (必須)</label>
                          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none" />
                        </div>
                        <div>`;
const uiNew = `<div>
                          <label className="text-xs text-neutral-400 font-bold mb-1 block">商材LPのURL (必須)</label>
                          <div className="flex gap-2">
                            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="flex-grow bg-neutral-900 border border-neutral-700 rounded p-3 text-white focus:border-teal-500 outline-none" />
                            <button onClick={handleAnalyzeLp} className="bg-teal-600 hover:bg-teal-500 text-white px-4 font-bold rounded shadow-lg whitespace-nowrap text-sm flex items-center gap-1"><ScanEye className="w-4 h-4"/> 解析</button>
                          </div>
                        </div>
                        <div>`;
code = code.replace(uiTarget, uiNew);

// 5. Update the Insights Panel display block to support LP specifics if needed, but the current keys 'inferred_product_name', 'inferred_target_demographic', 'main_appeal' exactly match the new analyze-lp backend keys!
// However, maybe we should add worldview if it exists!
const insightUiTarget = `<div><span className="font-bold text-teal-400">メイン訴求:</span> {insightData.main_appeal}</div>
                      </div>`;
const insightUiNew = `<div><span className="font-bold text-teal-400">メイン訴求:</span> {insightData.main_appeal}</div>
                        {insightData.worldview && <div><span className="font-bold text-teal-400">世界観/トーン:</span> {insightData.worldview}</div>}
                      </div>`;
code = code.replace(insightUiTarget, insightUiNew);


fs.writeFileSync('src/app/page.tsx', code);
console.log('LP Analyze implementation done!');
