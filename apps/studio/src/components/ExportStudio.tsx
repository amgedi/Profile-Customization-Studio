/**
 * Export Studio (0.2.6 R49–R54, R96–R100) — the primary export surface.
 * Tabs: Export File · Publish Online · Profile Package.
 * LEFT: target browser (from the verified platform registry).
 * CENTER: preview of the ACTUAL converted output (crop/flatten applied).
 * RIGHT: settings — beginner presets in Quick, exact controls in Advanced.
 * A conversion report always shows what PCS will change before exporting.
 */
import { encodeMotion, videoSupported, type MotionFormat } from '../motionExport.js';
import { saveMotionBlob } from '../io.js';
import { AdaptStudio } from "./AdaptStudio.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderSvg } from "@pcs/scene-core";
import { rasterizeSvg, saveDataUrl, exportSvg, exportPackage } from "../io.js";
import { TARGET_REGISTRY, TARGET_CATEGORIES, getTarget, type TargetDef } from "../targets/registry.js";
import { planConversion, describePlan } from "../targets/convert.js";
import { buildExportPackage, ensureProjectDefaults, collectPhotoData, inlinePhotos } from "../github/export.js";
import { runtimePrefs } from "../prefs.js";
import { isTauri } from "../tauri.js";
import type { Editor } from "../editor.js";
import { TargetCapabilities } from "./TargetCapabilities.js";
import { TargetPreview } from "./TargetPreview.js";
import { APP_VERSION } from "../version.js";
import { recordRecent as recordPresetUse } from "../presetStore.js";
import { useOutsideClose } from "./useOutsideClose.js";

type Tab = "file" | "online" | "package" | "everywhere";
type Preset = "recommended" | "best" | "small" | "animated" | "static" | "transparent";

const QUICK_PRESETS: Array<{ id: Preset; label: string; blurb: string }> = [
  { id: "recommended", label: "Target Recommended", blurb: "Platform size and a compatible format" },
  { id: "best", label: "Best Quality", blurb: "Full size, PNG, maximum fidelity" },
  { id: "small", label: "Small File", blurb: "Compact size for fast uploads" },
  { id: "transparent", label: "Transparent", blurb: "Keep empty areas see-through (PNG)" },
];

/** Platform pages PCS can open for manual upload (R99 — honest wording). */
const MANUAL_UPLOAD_URLS: Record<string, string> = {
  "discord-profile-banner": "https://discord.com/channels/@me",
  "youtube-channel-banner": "https://www.youtube.com/customize",
  "x-profile-header": "https://x.com/settings/profile",
  "linkedin-background": "https://www.linkedin.com/in/me/",
  "twitch-profile-banner": "https://dashboard.twitch.tv/settings/profile",
};

export function ExportStudio({ editor, onClose, onOpenPublishWizard }: {
  editor: Editor;
  onClose: () => void;
  onOpenPublishWizard: () => void;
}) {
  const [tab, setTab] = useState<Tab>("file");
  const [targetId, setTargetId] = useState<string>(editor.exportTargetId);
  const [preset, setPreset] = useState<Preset>("recommended");
  const [scaleMode, setScaleMode] = useState<"fit"|"cover-crop">("cover-crop");
  const [focalX,setFocalX]=useState(.5), [focalY,setFocalY]=useState(.5);
  const [encoded,setEncoded]=useState<string|null>(null),[encodingError,setEncodingError]=useState('');
  const [advFormat, setAdvFormat] = useState<"png" | "jpg" | "webp" | "svg">("png");
  const [customWidth,setCustomWidth]=useState(editor.doc.canvas.width),[customHeight,setCustomHeight]=useState(editor.doc.canvas.height);
  const [flatten, setFlatten] = useState<string>("#0f1115");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [motionFormat,setMotionFormat]=useState<MotionFormat>('gif'),[motionFps,setMotionFps]=useState(15),[motionDuration,setMotionDuration]=useState(Math.min(60,editor.doc.animation?.duration??8)),[motionLoop,setMotionLoop]=useState(true),[videoCaps,setVideoCaps]=useState({mp4:false,webm:false}),[motionUrl,setMotionUrl]=useState('');
  const motionAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>motionAbort.current?.abort(),[]);
  useEffect(()=>()=>{if(motionUrl)URL.revokeObjectURL(motionUrl);},[motionUrl]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOutsideClose(surfaceRef, onClose);

  const target = useMemo(()=>{const base=getTarget(targetId)??TARGET_REGISTRY[0]!;return base.id==='custom-target'?{...base,recommended:{width:customWidth,height:customHeight}}:base;},[targetId,customWidth,customHeight]);
  const doc = editor.doc;
  const [posterTime,setPosterTime]=useState((editor.doc.animation?.duration??8)/2);
  useEffect(()=>editor.setPlaying(false),[]);
  const quick = editor.experience !== "advanced";

  const project = useMemo(() => ensureProjectDefaults(editor.currentProject()), [editor.project, editor.doc]);
  const [photoData, setPhotoData] = useState<Record<string, string>>({});
  useEffect(() => { void collectPhotoData(project).then(setPhotoData); }, [project]);
  useEffect(()=>{const saved=editor.project.settings?.targetOverrides?.[targetId];setScaleMode(saved?.scaleMode??'cover-crop');setFocalX(saved?.focalX??.5);setFocalY(saved?.focalY??.5);},[targetId]);
  const framing=(change:Partial<{scaleMode:'fit'|'cover-crop';focalX:number;focalY:number}>)=>{
    const value={scaleMode,focalX,focalY,...change};setScaleMode(value.scaleMode);setFocalX(value.focalX);setFocalY(value.focalY);
    editor.setProjectMeta({settings:{...editor.project.settings,targetOverrides:{...editor.project.settings?.targetOverrides,[targetId]:value}}});
  };
  // Non-destructive conversion plan (R46–R48) — computed, never applied.
  const plan = useMemo(() => {
    return planConversion(doc, target, {
      preferAnimated: preset === "animated",
      format: quick ? ((preset === "small" || (preset === "recommended" && (target.maxFileSizeMB??100)<=2)) && target.staticFormats.includes("jpg") ? "jpg" : "png") : advFormat,
      scaleMode,focalX,focalY,
      flattenBackground: flatten,
    });
  }, [doc, target, preset, advFormat, flatten,quick,scaleMode,focalX,focalY]);

  // Preview of the ACTUAL converted output (R53): cover-crop + flatten.
  const previewSvg = useMemo(() => {
    const master = renderSvg(inlinePhotos(preset === "transparent" && target.supportsAlpha ? {...doc,canvas:{...doc.canvas,background:"#00000000"}} : doc,photoData), { animate: false, editable: false, time:posterTime });
    const crop = plan.crop ?? { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height };
    const inner = master.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.output.width}" height="${plan.output.height}" viewBox="0 0 ${plan.output.width} ${plan.output.height}">`+
      (plan.output.alpha?'':`<rect width="100%" height="100%" fill="${plan.output.flattenBackground??flatten}"/>`)+
      `<svg width="${plan.output.width}" height="${plan.output.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${inner}</svg></svg>`;
  }, [doc, plan,preset,target.supportsAlpha,posterTime,photoData]);

  useEffect(()=>{
    let alive=true;setEncoded(null);setEncodingError('');
    const timer=setTimeout(()=>{
      if(plan.output.format==='svg'){if(alive)setEncoded('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(previewSvg));return;}
      void rasterizeSvg(previewSvg,plan.output.width,plan.output.height,{format:plan.output.format as 'png'|'jpg'|'webp',quality:quick&&preset==='small'?.72:quality/100}).then(url=>{if(alive)setEncoded(url);}).catch(e=>{if(alive)setEncodingError(String(e));});
    },180);
    return()=>{alive=false;clearTimeout(timer);};
  },[previewSvg,quality,quick,preset,plan.output.format,plan.output.width,plan.output.height]);
  useEffect(()=>{let alive=true;void Promise.all([videoSupported('mp4',plan.output.width,plan.output.height,motionFps),videoSupported('webm',plan.output.width,plan.output.height,motionFps)]).then(([mp4,webm])=>{if(alive)setVideoCaps({mp4,webm});}).catch(()=>{if(alive)setVideoCaps({mp4:false,webm:false});});return()=>{alive=false;};},[plan.output.width,plan.output.height,motionFps]);
  const exportMotion=async()=>{
    const controller=new AbortController();motionAbort.current=controller;setBusy('Rendering motion…');setResult(null);
    try{const embedded=inlinePhotos(doc,await collectPhotoData(project));if(/"src":"photos\//.test(JSON.stringify(embedded)))throw Error('A scene photo could not be loaded. Retry after it loads.');const blob=await encodeMotion(embedded,{format:motionFormat,width:plan.output.width,height:plan.output.height,duration:motionDuration,fps:motionFps,loop:motionLoop,background:flatten,crop:plan.crop,signal:controller.signal,onProgress:p=>setBusy('Rendering '+Math.round(p*100)+'%')});
      setMotionUrl(URL.createObjectURL(blob));if(target.maxFileSizeMB&&blob.size>target.maxFileSizeMB*1024*1024){setResult('Rendered '+(blob.size/1048576).toFixed(2)+' MB — above this target’s limit. Reduce duration, dimensions or FPS.');return;}
      setBusy('Saving motion…');const saved=await saveMotionBlob(blob,editor.project.name.replace(/[\\/:*?"<>|]/g,'_')+'-'+target.id+'.'+motionFormat);setResult(saved?'Saved '+saved+' · '+(blob.size/1048576).toFixed(2)+' MB':null);
    }catch(e){setResult(e instanceof DOMException&&e.name==='AbortError'?'Motion export cancelled.':'Motion export failed: '+String(e));}finally{motionAbort.current=null;setBusy(null);}
  };
  const actualBytes=encoded?(encoded.includes(';base64,')?Math.floor((encoded.length-encoded.indexOf(',')-1)*3/4):new TextEncoder().encode(previewSvg).length):0;
  const oversized=!!target.maxFileSizeMB&&actualBytes>target.maxFileSizeMB*1024*1024;
  const doExportFile = async () => {
    if(!encoded)return;
    setBusy('Saving…');setResult(null);
    try {
      const name=editor.project.name.replace(/[\\/:*?"<>|]/g,'_')+'-'+target.id+'.'+plan.output.format;
      const out=plan.output.format==='svg'?await exportSvg(previewSvg,name):await saveDataUrl(encoded,name);
      setResult(out?`Saved ${out}`:null);
    }catch(e){setResult(`Export failed: ${(e as Error).message}`);}finally{setBusy(null);}
  };

  // Profile Package (R54).
  const packageFiles = useMemo(() => { const files=buildExportPackage({
    project, lightDark: true, includeWorkflow: true, animatedContribution: true, photoData,
  }); if(!runtimePrefs().staticFallback){delete files["assets/banner-static.svg"];delete files["assets/contribution-static.svg"];}return files; }, [project, photoData]);

  const exportPackageNow = async () => {
    setBusy("Writing package…");
    const res = await exportPackage(packageFiles);
    setBusy(null);
    setResult(res ? `Package exported to ${res.dir}` : null);
  };

  const openManualUpload = async () => {
    const url = MANUAL_UPLOAD_URLS[target.id];
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="export-studio" ref={surfaceRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Export Studio">
        <header className="export-head">
          <h2>Export Studio</h2>
          <span className="version-chip">{APP_VERSION}</span>
          <span style={{ flex: 1 }} />
          <nav className="segmented" aria-label="Export tabs"><button className={tab==='everywhere'?'active':''} onClick={()=>setTab('everywhere')}>Smart Adapt / Everywhere</button>
            <button className={tab === "file" ? "active" : ""} onClick={() => setTab("file")}>Export File</button>
            <button className={tab === "online" ? "active" : ""} onClick={() => setTab("online")}>Publish Online</button>
            <button className={tab === "package" ? "active" : ""} onClick={() => setTab("package")}>Profile Package</button>
          </nav>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </header>

        {tab === "everywhere" && <AdaptStudio editor={editor} onClose={()=>setTab('file')}/>}
        {tab === "file" && (
          <div className="export-body">
            {/* LEFT — target browser */}
            <aside className="export-targets">
              {TARGET_CATEGORIES.map((cat) => {
                const targets = TARGET_REGISTRY.filter((t) => t.category === cat.id);
                if (targets.length === 0) return null;
                return (
                  <div key={cat.id} className="export-target-group">
                    <div className="palette-cat">{cat.label}</div>
                    {targets.map((t) => (
                      <button key={t.id} className={"export-target" + (t.id === targetId ? " selected" : "")} onClick={() => { setTargetId(t.id); editor.setExportTargetId(t.id); recordPresetUse("target", t.id); }}>
                        <span>{t.displayName}</span>
                        <span className="paint-hint">{t.recommended.width}×{t.recommended.height}
                          {t.verification === "unverified" ? " · unverified" : ""}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </aside>

            {/* CENTER — actual output preview + conversion report */}
            <section className="export-preview">
              <div className={"export-canvas" + (plan.output.alpha ? " transparency-grid" : "")}>
                {encoded ? <TargetPreview key={target.id} target={target} src={encoded} profile={editor.project.platformProfiles?.[target.id]}/> : <p>{encodingError||'Preparing exact output…'}</p>}
              </div>
              <div className="export-report">
                <div className="export-report-head">
                  <strong>{target.displayName}</strong>
                  <span className="badge badge-ambient">{plan.output.width}×{plan.output.height} · {String(plan.output.format).toUpperCase()}{plan.output.animated ? " · animated" : ""}</span>
                  {target.verification === "unverified" && <span className="badge" style={{ color: "var(--pcs-warning)" }}>Unverified rules</span>}
                </div>
                {plan.changes.length > 0 && (
                  <>
                    <p className="paint-hint">PCS will create this by:</p>
                    <ul className="export-plan-list">
                      {describePlan(plan).map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  </>
                )}
                {plan.warnings.map((w, i) => (
                  <p key={i} className="paint-hint" style={{ color: "var(--pcs-warning)" }}>⚠ {w.label}: {w.detail}</p>
                ))}
                <p className="paint-hint">Your master design is preserved.</p>
              </div>
            </section>

            {/* RIGHT — settings */}
            <aside className="export-settings"><label>Still frame · {posterTime.toFixed(2)}s<input type="range" aria-label="Export still frame" min={0} max={doc.animation?.duration??8} step={.01} value={posterTime} onChange={e=>setPosterTime(+e.target.value)}/></label><p className="paint-hint">Choose the frame to save. Use Composited motion below to encode the complete scene.</p><TargetCapabilities target={target}/>
              {quick ? (
                <>
                  <div className="palette-cat">Preset</div>
                  {QUICK_PRESETS.map((p) => (
                    <button key={p.id} className={"export-preset" + (preset === p.id ? " selected" : "")} disabled={p.id === "transparent" && !target.supportsAlpha} onClick={() => setPreset(p.id)}>
                      <span>{p.label}</span>
                      <span className="paint-hint">{p.blurb}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="palette-cat">Format</div>
                  <div className="segmented">
                    {(["png", "jpg", "webp", "svg"] as const).map((f) => (
                      <button key={f} className={advFormat === f ? "active" : ""} onClick={() => setAdvFormat(f)}>{f}</button>
                    ))}
                  </div>
                  <div className="palette-cat" style={{ marginTop: 10 }}>Dimensions</div>
                  <p className="paint-hint">{plan.output.width}×{plan.output.height} (target recommended)</p>
                  <div className="palette-cat" style={{ marginTop: 10 }}>Transparency</div>
                  <p className="paint-hint">{plan.output.alpha ? "Alpha kept" : `Flattened to ${plan.output.flattenBackground ?? flatten}`}</p>
                  {!plan.output.alpha && (
                    <input className="field-input" type="color" value={flatten} onChange={(e) => setFlatten(e.target.value)} aria-label="Flatten background" />
                  )}
                  {plan.output.format !== "png" && plan.output.format !== "svg" && (
                    <>
                      <div className="palette-cat" style={{ marginTop: 10 }}>Quality</div>
                      <input className="field-input" type="number" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} aria-label="Quality" />
                    </>
                  )}
                  {plan.output.animated && (
                    <p className="paint-hint" style={{ marginTop: 8 }}>Animation: {plan.output.fps ?? 15} FPS, looping (GIF).</p>
                  )}
                </>
              )}
              {targetId==='custom-target'&&<><div className="palette-cat">Custom output dimensions</div><label>Width<input className="field-input" aria-label="Custom output width" type="number" min="16" max="8192" value={customWidth} onChange={e=>setCustomWidth(Math.max(16,Math.min(8192,Number(e.target.value)||16)))}/></label><label>Height<input className="field-input" aria-label="Custom output height" type="number" min="16" max="8192" value={customHeight} onChange={e=>setCustomHeight(Math.max(16,Math.min(8192,Number(e.target.value)||16)))}/></label></>}
              <section className="motion-export-controls"><h3>Composited motion</h3><div className="segmented">{(['gif','webm','mp4'] as const).map(f=><button key={f} disabled={!!busy||(f!=='gif'&&!videoCaps[f])} className={motionFormat===f?'active':''} onClick={()=>{setMotionFormat(f);setMotionUrl('');}}>{f.toUpperCase()}</button>)}</div><p>GIF loops; videos are silent. Video availability depends on your runtime. Motion is flattened onto the background color. GIF uses a 256-color palette.</p><label>Duration (seconds)<input aria-label="Motion export duration" type="number" min="0.1" max="60" step="0.1" value={motionDuration} onChange={e=>setMotionDuration(Number(e.target.value))}/></label><label>Frames per second<input aria-label="Motion export FPS" type="number" min="1" max="30" value={motionFps} onChange={e=>setMotionFps(Number(e.target.value))}/></label><label>Background<input aria-label="Motion export background" type="color" value={flatten} onChange={e=>setFlatten(e.target.value)}/></label>{motionFormat==='gif'&&<label><input type="checkbox" checked={motionLoop} onChange={e=>setMotionLoop(e.target.checked)}/> Loop GIF</label>}<p>Maximum 60 seconds, 30 FPS, 4 megapixels. Platform acceptance is separate: {target.animationSupport==='none'?'this target accepts still images; use motion elsewhere.':target.animatedFormats.join(', ').toUpperCase()||'check upload guidance'}.</p><button className="btn primary" disabled={!!busy||(motionFormat!=='gif'&&!videoCaps[motionFormat])} onClick={()=>void exportMotion()}>Export composited {motionFormat.toUpperCase()}</button>{busy&&motionAbort.current&&<button className="btn" onClick={()=>motionAbort.current?.abort()}>Cancel motion export</button>}{motionUrl&&(motionFormat==='gif'?<img src={motionUrl} alt="Encoded motion preview" style={{width:'100%'}}/>:<video src={motionUrl} controls style={{width:'100%'}}/>)}</section><div className="palette-cat">Framing</div>
              <div className="segmented"><button className={scaleMode==='cover-crop'?'active':''} onClick={()=>framing({scaleMode:'cover-crop'})}>Fill</button><button className={scaleMode==='fit'?'active':''} onClick={()=>framing({scaleMode:'fit'})}>Fit whole design</button></div>
              {scaleMode==='cover-crop'&&<><label>Focus horizontally<input aria-label="Horizontal crop focus" type="range" min="0" max="1" step=".01" value={focalX} onChange={e=>framing({focalX:Number(e.target.value)})}/></label><label>Focus vertically<input aria-label="Vertical crop focus" type="range" min="0" max="1" step=".01" value={focalY} onChange={e=>framing({focalY:Number(e.target.value)})}/></label></>}
              <p className="paint-hint">{encoded?`${(actualBytes/1024).toFixed(1)} KB encoded`:'Encoding…'}{target.maxFileSizeMB?` · ${target.maxFileSizeMB} MB limit`:''}</p>
              {oversized&&<p role="alert">This file exceeds the upload limit. Try Small File or JPG.</p>}
              {target.sourceUrl&&<a href={target.sourceUrl} target="_blank" rel="noreferrer">Platform upload guidance</a>}
              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <button className="btn primary" style={{ width: "100%" }} disabled={!!busy || !encoded || oversized} onClick={() => void doExportFile()}>
                  {busy ?? `Export ${String(plan.output.format).toUpperCase()}`}
                </button>
                {result && <p className="paint-hint" style={{ marginTop: 6 }}>{result}</p>}
              </div>
            </aside>
          </div>
        )}

        {tab === "online" && (
          <div className="export-online">
            <h3>Publish Online</h3>
            {target.id === "github-profile-readme" || target.id === "github-repo-social" ? (
              <>
                <p className="dialog-sub">
                  GitHub supports automatic publishing: PCS writes the banner, README, stats and
                  contribution game straight into your repository (with review before anything is overwritten).
                </p>
                <button className="btn primary" onClick={() => { onClose(); onOpenPublishWizard(); }}>
                  Open the GitHub publish wizard
                </button>
              </>
            ) : (
              <>
                <p className="dialog-sub">
                  {target.displayName} does not have a public API that PCS can publish through
                  {MANUAL_UPLOAD_URLS[target.id] ? "" : " (or PCS has not verified one)"}.
                  PCS will export the correct file and open the platform&apos;s upload page for you.
                </p>
                <div className="publish-actions">
                  <button className="btn primary" disabled={!!busy || !encoded || oversized} onClick={() => void doExportFile()}>
                    {busy ?? "Export for this platform"}
                  </button>
                  {MANUAL_UPLOAD_URLS[target.id] && (
                    <button className="btn" onClick={() => void openManualUpload()}>
                      Open {target.displayName} settings
                    </button>
                  )}
                </div>
                <p className="paint-hint">PCS only says “Publish Automatically” when a platform officially supports it (R99).</p>
              </>
            )}
          </div>
        )}

        {tab === "package" && (
          <div className="export-package">
            <h3>Profile Package</h3>
            <p className="dialog-sub">Everything a GitHub profile needs, generated from this project.</p>
            <div className="publish-files">
              {Object.keys(packageFiles).map((f) => (
                <div key={f} className="publish-file">📄 {f}</div>
              ))}
            </div>
            <p className="paint-hint">Includes SETUP instructions in plain language (R54).</p>
            <button className="btn primary" disabled={!!busy} onClick={() => void exportPackageNow()}>
              {busy ?? "Export package…"}
            </button>
            {result && <p className="paint-hint" style={{ marginTop: 6 }}>{result}</p>}
          </div>
        )}

        {!isTauri() && <p className="paint-hint" style={{ padding: "0 16px 10px" }}>Browser preview: exports download as files.</p>}
      </div>
    </div>
  );
}
