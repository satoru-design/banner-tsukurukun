const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// 1. Add baseImagePrompt state
code = code.replace(
  "const [manualImagePrompt, setManualImagePrompt] = useState('');",
  "const [manualImagePrompt, setManualImagePrompt] = useState('');\n  const [baseImagePrompt, setBaseImagePrompt] = useState('');"
);

// 2. Update selectAngle
code = code.replace(
  "setManualImagePrompt(v.design_specs?.image_gen_prompt || \"\");",
  "setBaseImagePrompt(v.design_specs?.image_gen_prompt || \"\");\n    // Don't set setManualImagePrompt here directly, let useEffect handle it"
);

// 3. Add the mega-prompt generation useEffect
const useEffectPoint = "// ---- Step 4: Editor State ----";
const megaPromptEffect = `
  // ---- Mega-Prompt Realtime Engine ----
  React.useEffect(() => {
    if (!baseImagePrompt && step < 3) return;
    
    let layoutInstruction = "";
    if (layoutStyle === 'left') layoutInstruction = "-- Layout & Composition --\\n[CRITICAL RULE]: The ENTIRE LEFT HALF of the image MUST definitively be completely empty, clean negative space (e.g., solid studio wall, clear smooth surface). Place the main primary subject STRICTLY AND ONLY on the FAR RIGHT EDGE. Do not place any objects, limbs, or textures in the left half, it must remain pristine for typography overlay.";
    else if (layoutStyle === 'right') layoutInstruction = "-- Layout & Composition --\\n[CRITICAL RULE]: The ENTIRE RIGHT HALF of the image MUST definitively be completely empty, clean negative space. Place the main primary subject STRICTLY AND ONLY on the FAR LEFT EDGE. Do not place any objects, limbs, or textures in the right half.";
    else if (layoutStyle === 'center') layoutInstruction = "-- Layout & Composition --\\n[CRITICAL RULE]: Leave a massive, clean, empty negative space in the dead center. The subject and visual elements should solely frame the outer borders.";

    const personConstraint = hasPerson === 'yes' ? \`\\n-- Subject Specifications --\\nThe scene MUST prominently feature a human subject. Attributes required: \${personAttr || "Professional, highly natural, perfectly fitting the commercial product context"}. Authentic expression, vivid details.\` 
                           : (hasPerson === 'no' ? \`\\n-- Subject Specifications --\\n[STRICT RULE]: ABSOLUTELY NO PEOPLE. The image must be entirely devoid of any human presence or body parts. Focus entirely on the environment and atmosphere.\` : "\\n-- Subject Specifications --\\nSubject can be human or abstract, but must fit the core theme.");

    const toneConstraint = \`\\n-- Atmosphere, Lighting & Tone --\\nOverall design tone: \${bannerTone || "Clean, commercial photography quality"}. Lighting should be masterfully crafted, with cinematic depth of field, balanced shadows, and high-end advertising rendering.\`;

    const userAdditions = additionalInstructions ? \`\\n-- Additional Custom Instructions --\\n\${additionalInstructions}\` : "";

    const finalMegaPrompt = \`\${layoutInstruction}\${personConstraint}\${toneConstraint}\\n\\n-- Core Visual Description --\\n\${baseImagePrompt}\\n\\n-- Technical Specs --\\n4k, highly detailed, photorealistic, professional lighting, no text, no watermarks, flawless aesthetic.\${userAdditions}\`;
    
    setManualImagePrompt(finalMegaPrompt);
  }, [layoutStyle, bannerTone, hasPerson, personAttr, additionalInstructions, baseImagePrompt]);

  // ---- Step 4: Editor State ----`;

code = code.replace(useEffectPoint, megaPromptEffect);

// 4. Update the handleGenerateBg API call to NOT concatenate, and just send manualImagePrompt!
const generateRegex = /  const handleGenerateBg = async \(\) => \{[\s\S]*?const masterPrompt = \`.*?;\n/m;
const newGenerate = `  const handleGenerateBg = async () => {
    const masterPrompt = manualImagePrompt;
`;
code = code.replace(generateRegex, newGenerate);

// 5. Fix the canvas scale overflow by subtracting 32px from cw
const scaleRegex = /const calculatedScale = Math\.min\(cw \/ canvasSize\.w, ch \/ canvasSize\.h, 1\);/m;
const newScale = `const calculatedScale = Math.min((cw - 16) / canvasSize.w, (ch - 16) / canvasSize.h, 1);`;
code = code.replace(scaleRegex, newScale);

fs.writeFileSync('src/app/page.tsx', code);
console.log('Patch complete!');
