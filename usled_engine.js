// ═══════════════════════════════════════════════════════════════
// usled_engine.js — USLED 單一成本/規格引擎 v9.63
// 來源：index.html v9.62 原封搬移（AI 團隊工單 #3，2026-07-08）
// ⚠ 規格 / 成本 / KPI 算式只准改這裡；index.html（快速報價 PWA）與
//    USLED_參數編輯器.html 皆載入本檔共用同一份算式。
// 載入順序：本檔在前，載入端 script 在後。
//   - PWA：定義 BUILTIN_CFG 後呼叫 engineInit(BUILTIN_CFG)。
//   - 編輯器：以 BUILD_CFG_OBJECT() 組 cfg 後呼叫 engineInit(cfg)＋buildFromJson(cfg)。
// ═══════════════════════════════════════════════════════════════

// 外部依賴殼：PWA 會在後續 script 宣告真身；無宣告環境（如編輯器）用空殼避免 ReferenceError
var TIERS = (typeof TIERS==='undefined') ? [] : TIERS;
var QUICK_REF_PER_CHAR = (typeof QUICK_REF_PER_CHAR==='undefined') ? {} : QUICK_REF_PER_CHAR;
var BUILTIN_CFG = (typeof BUILTIN_CFG==='undefined') ? null : BUILTIN_CFG;

// ══ 資料 ══
var MODS=[], FRMS=[], PWRS=[], CTRL=[];
var BACK_OFFSET={O:0,N:0,S:1.5,X:2.5,I:4.0,J:3.7,R:4.5,A:7.5,P:8.5,D:4.5};
// v9.4：含框厚度 T（cm）— 由使用者規格決定，跟成本/重量計算無關，僅用於報價單外觀
var FRAME_THICKNESS={R:9, P:9, N:9, J:6, I:6, X:3.8, A:8, D:11.5, S:3.8, O:0};
// v9.9：固定件每件長度偏移（mm）— 戶外用「固定 B-門型鐵」，室內用「固定 A-玻纖板」
// 每件長度 = 模組顯示高度 (dispH cm) + 此偏移 (mm/10 cm)
var BRACKET_OFFSET_MM = {
  P: 30, R: 25, J: 16, A: 25, N: 25, D: 0,  // 戶外框 → 固定 B-門型鐵（D 框 ㄇ鐵=顯示高度，無偏移）
  X: 16, I: 16, S: 16,                 // 室內框 → 固定 A-玻纖板
  O: 0
};
// v9.9：電源器廠牌規格對照表（待擴充）。沒對應的 fallback 顯示 (XXX W)
// TODO: PWR_META 雙宣告+voltage/vlt 欄位名不一致待統一（HEAD 既有行為，零變動原則本輪不動），見 HANDOFF 遺留
var PWR_META = {
  HBM: {brand:'明瑋', spec:'5V60A', voltage:'AC 220V'}
  // TODO: 其他電源廠牌規格待 Jason 提供
  // HAM/HAT/HBT/HSH1/HSH2/HSM1/HSM2/HSM3/LAA0/LAA3/LAA6/LBG1/LBH1/LBH2/LBH3/LCH2
};
// v9.9：大型控制卡（接收卡型）— 顯示寬度每 > 256 點要加一組「接收卡 R712 + 網路線」
var BIG_CTRL_IDS = ['HD-C16L', 'HD-A3L', 'HD-A4', 'HD-A5L'];

// ══ 靜態 meta ══
var MOD_META={
  P10R:{mh:16,ml:32,ch:1,cw:2,water:'全戶外'},P10C:{mh:16,ml:32,ch:1,cw:2,water:'全戶外'},
  P10S:{mh:16,ml:32,ch:1,cw:2,water:'全戶外'},P08C:{mh:12.8,ml:25.6,ch:1,cw:2,water:'全戶外'},
  P06C:{mh:19.2,ml:19.2,ch:2,cw:2,water:'全戶外'},P05C:{mh:16,ml:32,ch:2,cw:4,water:'全戶外'},
  P5CM:{mh:16,ml:16,ch:2,cw:2,water:'全戶外'},P04C:{mh:12.8,ml:25.6,ch:2,cw:4,water:'全戶外'},
  P03C:{mh:19.2,ml:19.2,ch:4,cw:4,water:'全戶外'},P25F:{mh:16,ml:32,ch:4,cw:8,water:'全戶外'},
  M10C:{mh:16,ml:32,ch:1,cw:2,water:'半戶外'},M10R:{mh:16,ml:32,ch:1,cw:2,water:'半戶外'},
  M05C:{mh:16,ml:32,ch:2,cw:4,water:'室內'},
  M04C:{mh:12.8,ml:25.6,ch:2,cw:4,water:'室內'},M4CL:{mh:25.6,ml:25.6,ch:4,cw:4,water:'室內'},
  M47D:{mh:15.2,ml:30.4,ch:2,cw:4,water:'室內'},M03C:{mh:19.2,ml:19.2,ch:4,cw:4,water:'室內'},
  M25F:{mh:16,ml:32,ch:4,cw:8,water:'室內'},M02C:{mh:16,ml:32,ch:5,cw:10,water:'室內'},
  M186:{mh:16,ml:32,ch:5,cw:11,water:'室內'},Q04C:{mh:16,ml:32,ch:2.5,cw:5,water:'室內'}
};
var FRM_META={
  R:{model:'2590F3',edge:2.5,grp:'outdoor',name:'R框 戶外標準'},
  P:{model:'9045B',edge:4.5,grp:'outdoor',name:'P框 戶外加厚'},
  N:{model:'9025',edge:0,grp:'outdoor',name:'N框 戶外無邊'},
  J:{model:'2060',edge:2.0,grp:'outdoor',name:'J框 戶外輕薄'},
  A:{model:'092A',edge:4.0,grp:'outdoor',name:'A框 戶外重型'},
  D:{model:'11530',edge:3,grp:'outdoor',name:'D框 戶外雙面',forceDual:2,noBack:true},
  I:{model:'2260',edge:2.2,grp:'indoor',name:'I框 室內標準'},
  S:{model:'1025',edge:1.0,grp:'indoor',name:'S框 室內薄型'},
  X:{model:'3815',edge:1.5,grp:'indoor',name:'X框 室內輕量'},
  O:{model:'塑膠背板',edge:0,grp:'none',name:'O款 無框塑膠'}
};
var PWR_META={
  HAM:{brand:'明瑋',spec:'5V60A',vlt:'AC 110V',cat:'ac110'},
  HAT:{brand:'創聯',spec:'5V40A',vlt:'AC 110V',cat:'ac110'},
  HBM:{brand:'明瑋',spec:'5V60A',vlt:'AC 220V',cat:'ac220'},
  HBT:{brand:'創聯',spec:'5V40A',vlt:'AC 220V',cat:'ac220'},
  HSH1:{brand:'恒聯',spec:'5V10A',vlt:'AC 全電壓',cat:'acfull'},
  HSH2:{brand:'恒聯',spec:'5V15A',vlt:'AC 全電壓',cat:'acfull'},
  HSM1:{brand:'明瑋',spec:'5V10A',vlt:'AC 全電壓',cat:'acfull'},
  HSM2:{brand:'明瑋',spec:'5V20A',vlt:'AC 全電壓',cat:'acfull'},
  HSM3:{brand:'明瑋',spec:'5V30A',vlt:'AC 全電壓',cat:'acfull'},
  LAA0:{brand:'無',spec:'—',vlt:'DC 5V',cat:'dc5'},
  LAA3:{brand:'黑殼',spec:'5V3A',vlt:'DC 5V',cat:'dc5'},
  LAA6:{brand:'黑殼',spec:'5V6A',vlt:'DC 5V',cat:'dc5'},
  LBG1:{brand:'灌膠',spec:'5V10A',vlt:'DC 12-24V',cat:'dc24'},
  LBH1:{brand:'恒聯',spec:'5V10A',vlt:'DC 12-30V',cat:'dc24'},
  LBH2:{brand:'恒聯',spec:'5V20A',vlt:'DC 12-30V',cat:'dc24'},
  LBH3:{brand:'恒聯',spec:'5V30A',vlt:'DC 12-30V',cat:'dc24'},
  LCH2:{brand:'恒聯',spec:'5V20A',vlt:'DC 15-75V',cat:'dc75'}
};
var CTRL_META={
  'HD-D16':{brand:'HD',spec:'4萬點 640×64',proto:'屏掌控'},
  'HD-C16L':{brand:'HD',spec:'65萬像素 最寬2048',proto:'屏掌控'},
  'HD-U6A':{brand:'HD',spec:'入門款',proto:'屏掌控'},
  'LM-30A':{brand:'其他',spec:'LM 控制卡',proto:''},
  'HD-A5L':{brand:'HD',spec:'高階非同步',proto:'屏掌控'},
  'HD-A4':{brand:'HD',spec:'中階非同步',proto:'屏掌控'},
  'HD-A3L':{brand:'HD',spec:'65萬非同步',proto:'屏掌控'},
  'HD-E64':{brand:'HD',spec:'同步入門',proto:'屏掌控'},
  'HD-W66':{brand:'HD',spec:'WiFi 控制',proto:'屏掌控'},
  'HD-WF4':{brand:'HD',spec:'768×128 最寬1280',proto:'屏掌控'},
  'HD-WF2':{brand:'HD',spec:'768×64 最寬1280',proto:'屏掌控'},
  'RHX-64W512':{brand:'RHX',spec:'64W512',proto:'RHX'},
  'RHX-32W320':{brand:'RHX',spec:'32W320',proto:'RHX'},
  'RHX-Q10':{brand:'RHX',spec:'全彩160×640 低灰',proto:'RHX'},
  'RHX-Q8B':{brand:'RHX',spec:'128×384 低灰',proto:'RHX'},
  'RHX-Q4A1':{brand:'RHX',spec:'64×384 低灰',proto:'RHX'},
  'RHX-Q4AM':{brand:'RHX',spec:'64×192 低灰',proto:'RHX'},
  'RHX-64WUN1024':{brand:'RHX',spec:'64WUN1024',proto:'RHX'},
  'RHX-8Q2':{brand:'RHX',spec:'32×384 低灰',proto:'RHX'},
  'RHX-8C1':{brand:'RHX',spec:'16×768 低灰',proto:'RHX'}
};

// v9.62：parts/base 乾淨預設深拷貝——buildFromJson 每次以此為底 merge，避免連續套用部分 config 時舊值殘留
// v9.63：初始化改由 engineInit(builtinCfg) 執行（BUILTIN_CFG 資料留在 index.html；編輯器傳入自組 cfg）
var CFG_DEFAULT_PARTS = null, CFG_DEFAULT_BASE = null;
function engineInit(builtinCfg){
  if(!BUILTIN_CFG) BUILTIN_CFG = builtinCfg;   // 無 PWA 內建資料的環境（編輯器）：以傳入 cfg 為引擎資料容器
  CFG_DEFAULT_PARTS = JSON.parse(JSON.stringify(builtinCfg.parts));
  CFG_DEFAULT_BASE  = JSON.parse(JSON.stringify(builtinCfg.base));
}

// ── 從 JSON 檔建立 ──
function buildFromJson(cfg){
  // v9.62：套用 cfg.parts / cfg.base——每次從乾淨預設 merge（config 缺漏欄位回內建預設，不殘留前次套用值）
  BUILTIN_CFG.parts = Object.assign({}, CFG_DEFAULT_PARTS, cfg.parts||{});
  BUILTIN_CFG.base  = Object.assign({}, CFG_DEFAULT_BASE,  cfg.base||{});
  MODS=[];
  Object.keys(cfg.mods||{}).forEach(function(id){
    var m=MOD_META[id];if(!m)return;
    var d=cfg.mods[id];
    MODS.push(Object.assign({id:id,twd:d.twd,wg:d.wg,wpm:d.wpm},m));
  });
  FRMS=[];
  Object.keys(cfg.frms||{}).forEach(function(id){
    var m=FRM_META[id];if(!m)return;
    var d=cfg.frms[id];
    FRMS.push(Object.assign({id:id,wg_cm:d.wg_cm,corner_wg:d.corner_wg,price:d.price,corner:d.corner},m));
  });
  PWRS=[];
  Object.keys(cfg.pwrs||{}).forEach(function(id){
    var m=PWR_META[id];if(!m)return;
    var d=cfg.pwrs[id];
    PWRS.push(Object.assign({id:id,watt:d.watt,wg:d.wg,price:d.price,inwire_p:(d.inwire_rmb||0)*(BUILTIN_CFG.base.rate||4.7)},m));
  });
  CTRL=[];
  Object.keys(cfg.ctrl||{}).forEach(function(id){
    var m=CTRL_META[id]||{brand:'其他',spec:id,proto:''};
    var d=cfg.ctrl[id];
    CTRL.push(Object.assign({id:id,price:d.price,wg:d.wg},m));
  });
  if(cfg.tiers){
    // v9.17：用 cfgKey 對應而非位置（位置覆寫會被新增 tier 推亂）
    var t=cfg.tiers;
    TIERS.forEach(function(tier){
      if(tier.cfgKey && t[tier.cfgKey] != null){
        tier.margin = t[tier.cfgKey]/100;
      }
    });
  }
  // v9.25：快速報價單字單價（QUICK_REF_PER_CHAR）— 從 cfg.quickRef 覆寫
  if(cfg.quickRef){
    Object.keys(cfg.quickRef).forEach(function(mid){
      var v = parseFloat(cfg.quickRef[mid]);
      if(v > 0) QUICK_REF_PER_CHAR[mid] = v;
    });
  }
}

// ══ 完整型號解析 ══
// 解析格式：[模組][字高2位][字寬2位][-][鋁框1字][電源前綴]
// 例：M4C0208-XLA → M04C / 字高2 / 字寬8 / 鋁框X / 電源 LA*
//     P10C1124-RHA → P10C / 字高11 / 字寬24 / 鋁框R / 電源 HA*
//     M04C0208XLA  → 同上（- 可省略）
function parseFullModelCode(input){
  var raw=(input||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');   // 去空白與中文備註，只留代碼字元
  if(!raw) return {error:'請輸入型號'};

  // 找最長匹配的模組 ID（允許 leading-zero 容錯：M4C ↔ M04C）
  var best=null, bestLen=0;
  MODS.forEach(function(m){
    var mid=m.id.toUpperCase();
    if(raw.indexOf(mid)===0 && mid.length>bestLen){
      best={mod:m, len:mid.length};
      bestLen=mid.length;
    }
    var midNorm=mid.replace(/0(\d)/g,'$1');
    if(midNorm!==mid && raw.indexOf(midNorm)===0 && midNorm.length>bestLen){
      best={mod:m, len:midNorm.length};
      bestLen=midNorm.length;
    }
  });
  if(!best) return {error:'找不到對應模組「'+raw.slice(0,4)+'」'};

  var rest=raw.slice(best.len);
  // 字高 + 字寬（各 2 位數）
  var rows=null, cols=null;
  var m4=rest.match(/^(\d{2})(\d{2})/);
  if(m4){
    rows=parseInt(m4[1],10);
    cols=parseInt(m4[2],10);
    rest=rest.slice(4);
  }
  // 可選 "-"
  if(rest.charAt(0)==='-') rest=rest.slice(1);
  // 鋁框（1 字）
  var frm=null;
  if(rest.length>0){
    var fc=rest.charAt(0);
    var f=FRMS.find(function(x){return x.id.toUpperCase()===fc;});
    if(f){frm=f.id; rest=rest.slice(1);}
  }
  // 電源前綴（剩餘字串）
  var pwrPrefix=rest;
  var pwrCandidates=[];
  if(pwrPrefix){
    pwrCandidates=PWRS.filter(function(p){return p.id.toUpperCase().indexOf(pwrPrefix)===0;});
  }

  return {
    mod:best.mod, rows:rows, cols:cols, frm:frm,
    pwrPrefix:pwrPrefix, pwrCandidates:pwrCandidates
  };
}

// 純計算引擎：規格參數 → 完整 record（不碰畫面），供常規頁/比較表用。
// ⚠ 算式與下方 calc() 同源；若日後改算式，兩處要同步（calc 暫不動以免影響報價主流程）。
function computeRecord(mid,fid,pid,cid,rows,cols,dual,qty){
  rows=parseInt(rows)||1; cols=parseInt(cols)||1; dual=parseInt(dual)||1; qty=parseInt(qty)||1;
  var m=MODS.find(function(x){return x.id===mid;});
  if(!m) return null;
  var mRows=Math.round(rows/m.ch),mCols=Math.round(cols/m.cw);
  var Ds=mRows*mCols,D=Ds*dual;
  var dispH=m.mh*mRows,dispW=m.ml*mCols;
  var f=FRMS.find(function(x){return x.id===fid;}),fEdge=f?f.edge:0;
  var fh=dispH+fEdge*2,fw=dispW+fEdge*2;
  var p=PWRS.find(function(x){return x.id===pid;}),ct=CTRL.find(function(x){return x.id===cid;});
  var totalW=m.wpm*D,pwrN=0;
  if(p&&p.watt>0)pwrN=Math.ceil(totalW/(p.watt*1.0));
  var boff=f?(BACK_OFFSET[fid]||0):0;
  var backH=dispH+boff,backW=dispW+boff,cai=backH*backW/918;
  if(dual>1||(f&&f.noBack))cai=0;   // 雙面(含D框)無背板：另一面也是模組
  var modWg=m.wg*D,frmWg=f?(f.wg_cm*(fh+fw)*2+4*f.corner_wg):0;
  var pwrWg=p?p.wg*pwrN:0,ctrlWg=ct?ct.wg:0,backWg=cai*207;
  var totalKg=(modWg+frmWg+pwrWg+ctrlWg+backWg)/1000;
  var matCost=m.twd*D+(p?p.price*pwrN:0)+(ct?ct.price:0)+(f&&f.price?f.price*((fh+fw)*2):0);
  var parts=(BUILTIN_CFG.parts)||{};
  var workMin=0;
  workMin += qty * ((parts.t01||0.33) + (parts.t04||1));
  workMin += D * ((parts.t02||1.01) + (parts.t05||0.5) + (parts.t07||0.233));
  workMin += D * ((parts.t11||0.2) + (parts.t12||0.2));
  workMin += pwrN * ((parts.t10||5.867) + (parts.t17||1.5));
  workMin += qty * (parts.t16||5.5);
  if(f && f.grp!=='none') workMin += cai * (parts.t19||0.25);
  workMin += qty * (parts.t_pack||0);
  var workHr = workMin/60;
  var base=BUILTIN_CFG.base||{};
  var scO=base.scO||3.5, scIn=base.scIn||4.5, scOut=base.scOut||5.5, scDiv=base.scDiv||450;
  var longSide = Math.max(fh||dispH||0, fw||dispW||0);
  var kpi=0;
  // v9.62：KPI 改用框分類（grp）判斷，新框不再漏算；f=null（無框未選）視為 none
  var g = f ? f.grp : 'none';
  if(g==='none') kpi = (scO + D) * qty;
  else if(g==='indoor') kpi = (scIn + D) * qty;
  else { // outdoor 與未知框都走戶外式（保守偏高），未知時 console.warn
    if(g!=='outdoor') console.warn('KPI: unknown frame grp', fid, g);
    if(longSide<=112) kpi = (scOut + D*2) * qty;
    else kpi = (Math.round((fh*fw)/scDiv) + D*2) * qty;
  }
  var ptH=rows*16,ptW=cols*16,ptTotal=ptH*ptW;
  var chars=rows*cols*dual;
  var stdPrice=Math.round((m.twd*D*2.5)/100)*100;
  return {mid:mid,fid:fid,pid:pid,cid:cid,m:m,f:f,p:p,ct:ct,
    rows:rows,cols:cols,dual:dual,qty:qty,D:D,Ds:Ds,mRows:mRows,mCols:mCols,
    dispH:dispH,dispW:dispW,fh:fh,fw:fw,totalW:totalW,pwrN:pwrN,
    totalKg:totalKg,chars:chars,stdPrice:stdPrice,matCost:matCost,
    cai:cai,workMin:workMin,workHr:workHr,kpi:kpi,
    ptH:ptH,ptW:ptW,ptTotal:ptTotal};
}

// 常規型號 → 規格+成本（重用報價引擎）。格式：品牌(D/U)+模組+字高字寬+(-)+框+完整電源，如 DM4C0208-XLAA6
var CATALOG_BRAND = { 'D':{name:'DART', ctrl:'RHX-8Q2'}, 'U':{name:'US', ctrl:'HD-WF4'} };
function catalogCompute(code){
  var rawIn=(code||'').trim();
  var dualMark=/雙面/.test(rawIn)?2:(/單面/.test(rawIn)?1:0);   // 型號欄可夾「雙面/單面」中文標記
  var raw=rawIn.toUpperCase().replace(/[^A-Z0-9-]/g,'');   // 剝除中文備註，只留代碼字元
  if(!raw) return {ok:false, error:'空型號'};
  var brand=CATALOG_BRAND[raw.charAt(0)];
  var rest=brand?raw.slice(1):raw;
  var cid=brand?brand.ctrl:'HD-WF4';   // 無品牌前綴(型號未帶 D/U)時，控制卡預設 WF4
  var p=parseFullModelCode(rest);
  if(p.error) return {ok:false, error:p.error, brandName:brand?brand.name:''};
  var pid=(p.pwrCandidates&&p.pwrCandidates.length)?p.pwrCandidates[0].id:null;
  // v9.71：電源前綴有字但比對不到任何電源 → 靜默漏算改為明示警告（成本仍照原邏輯計算，不含電源）
  var pwrWarn=(p.pwrPrefix&&!pid)?('電源代碼無法解析（'+p.pwrPrefix+'）——成本未含電源'):null;
  var _fobj=p.frm?FRMS.find(function(x){return x.id===p.frm;}):null;
  var _dual=(_fobj&&_fobj.forceDual)?_fobj.forceDual:(dualMark||1);   // D框強制雙面；其他框看型號「雙面」標記
  var r=computeRecord(p.mod.id, p.frm, pid, cid, p.rows||1, p.cols||1, _dual, 1);
  if(!r) return {ok:false, error:'無法建立規格', brandName:brand?brand.name:''};
  var cost=null;
  try{ var fc=computeFullCostBreakdown(r); cost=Math.round(fc.totalCost); r.totalCost=fc.totalCost; }catch(e){ console.warn('catalog cost fail',code,e); }
  var out={ok:true, brandName:brand?brand.name:'', r:r, cost:cost, pid:pid, cid:cid};
  if(pwrWarn) out.warning=pwrWarn;
  return out;
}

// ══ 成本計算（材料明細＋工時明細＋總成本）══
// 計算完整材料明細、工時明細、總成本
// 工時成本 = 積分(kpi) × sp（委外工資，每積分 $22，定義在 BUILTIN_CFG.base.sp）
function computeFullCostBreakdown(r){
  var parts=BUILTIN_CFG.parts||{};
  var base=BUILTIN_CFG.base||{};
  var sp=base.sp||22;  // 積分 → 委外工資 ($/分)

  // v9.8：材料明細加入規格註解，並按「框 → 結構 → 模組 → 電源 → 電子 → 附件 → 膠化 → 線材」排序
  // 計算前置：背板尺寸 (cm)、附件每件長度 (cm)
  var backH = r.cai>0 ? (r.dispH + (BACK_OFFSET[r.fid]||0)) : 0;
  var backW = r.cai>0 ? (r.dispW + (BACK_OFFSET[r.fid]||0)) : 0;
  // v9.9：固定件長度依框型偏移（P+30/R+25/J+16/A+25 mm 戶外；X+16/I+16 mm 室內）
  var bracketOffsetCm = ((r.fid in BRACKET_OFFSET_MM) ? BRACKET_OFFSET_MM[r.fid] : 30) / 10;
  var bracketLenCm = r.dispH + bracketOffsetCm;
  var bracketPerMachine = r.mCols + 1;  // 每台幾件
  var mats=[];

  // 1. 框（最上面）
  if(r.f && r.f.price){
    var perimCm=(r.fh+r.fw)*2;
    var fLabel='框料 '+r.fid+(r.f.model?' ('+r.f.model+')':'');
    mats.push({n:fLabel, q:perimCm.toFixed(1)+' cm', u:r.f.price, sub:r.f.price*perimCm, cat:'框'});
  }
  if(r.f && r.f.grp!=='none' && r.f.corner){  // v9.62：框角只對有框的收（O 塑膠背板無鋁彎角）
    var fcLabel='框角 '+r.fid+(r.f.model?' ('+r.f.model+')':'');
    mats.push({n:fcLabel, q:'4 個', u:r.f.corner, sub:r.f.corner*4, cat:'框'});
  }

  // 2. 結構（背板）
  if(r.f && r.f.grp!=='none' && r.cai){
    var backP=parts.back_p||45;
    var backLabel='背板 ('+Math.round(backH*10)+'×'+Math.round(backW*10)+'mm)';
    mats.push({n:backLabel, q:r.cai.toFixed(2)+' 才', u:backP, sub:r.cai*backP, cat:'結構'});
  }

  // 3. 模組
  var modLabel='模組 '+r.mid+' ('+Math.round(r.m.ml*10)+'×'+Math.round(r.m.mh*10)+'mm)';
  mats.push({n:modLabel, q:r.D+' 片', u:r.m.twd, sub:r.D*r.m.twd, cat:'模組'});

  // 4. 電子（電源器 + 控制卡 + 大型卡附屬接收卡）
  if(r.p){
    var pMeta = PWR_META[r.pid];
    var pDesc = pMeta
      ? '('+pMeta.brand+' '+pMeta.spec+(pMeta.voltage?' '+pMeta.voltage:'')+')'
      : '('+(r.p.watt||0)+'W)';
    mats.push({n:'電源器 '+r.pid+' '+pDesc, q:r.pwrN+' 顆', u:r.p.price, sub:r.pwrN*r.p.price, cat:'電子'});
  }
  if(r.ct){
    mats.push({n:'控制卡 '+r.cid, q:'1', u:r.ct.price, sub:r.ct.price, cat:'電子'});
  }
  // v9.9：大型控制卡（C16L/A3L/A4/A5L）寬度每 > 256 點要加一組接收卡 R712 + 網路線
  if(BIG_CTRL_IDS.indexOf(r.cid) >= 0){
    var rxGroups = Math.max(0, Math.ceil((r.ptW||0)/256) - 1);
    if(rxGroups > 0){
      var totalGroups = rxGroups * r.qty;
      mats.push({n:'接收卡 R712', q:totalGroups+' 個', u:330, sub:330*totalGroups, cat:'電子'});
      mats.push({n:'網路線 (200cm)', q:totalGroups+' 條', u:40, sub:40*totalGroups, cat:'線材'});
    }
  }

  function addPart(name, partKey, qty, cat){
    var p=parts[partKey+'_p'];
    if(p && qty>0) mats.push({n:name, q:qty.toFixed(1), u:p, sub:p*qty, cat:cat||'附件'});
  }

  // 6. 附件 + 滑軌（v9.9 滑軌獨立成一類；附件加規格標註）
  if(r.f && r.f.grp==='outdoor'){
    addPart('框角螺絲 (自攻)','cornscrew', 8*r.qty, '附件');
    var drains = Math.max(3, 3 + Math.floor(Math.max(r.dispH,r.dispW)/60));
    addPart('排水孔塞 (SB黑13mm)','drain', drains*r.qty, '附件');
    addPart('固定 B-門型鐵 (長度 '+bracketLenCm.toFixed(1)+' cm)','bracket', bracketPerMachine*bracketLenCm*r.qty, '附件');
    addPart('磁鐵 (1組4顆 強磁1513)','magnet', r.D*r.qty/4, '附件');
  }
  if(r.f && r.f.grp==='indoor'){
    addPart('框角螺絲 (自攻)','cornscrew', 4*r.qty, '附件');
    addPart('固定 A-玻纖板 (長度 '+bracketLenCm.toFixed(1)+' cm)','glass', bracketPerMachine*bracketLenCm*r.qty, '附件');
    // 滑軌獨立成「滑軌」類
    addPart('滑軌','rail', 4*r.qty, '滑軌');
  }
  // 7. 膠化（v9.9：加 N29透明 規格）
  addPart('膠化-前點膠 (N29透明)','preglue', r.D*r.qty, '膠化');
  if(r.f && r.f.grp==='outdoor') addPart('膠化-後滿膠 (N29透明)','fullglue', r.D*r.qty, '膠化');
  if(r.cai>0){
    addPart('膠化-封板 (N29透明)','sealglue', (backH+backW)*2*r.qty, '膠化');
  }
  // 8. 線材（v9.9：控制線加規格；新增 AC 電源線）
  addPart('排線','ribbon', r.D*r.qty, '線材');
  addPart('DC 電源線','dcwire', r.pwrN*r.qty, '線材');
  // AC 電源線：從插座到電源器，每台 1 條（暫定 $20/條，實際待 Jason 確認）
  mats.push({n:'AC 電源線 (1.8m)', q:r.qty+' 條', u:20, sub:20*r.qty, cat:'線材'});
  addPart('控制線 (0.5mm*2C-25cm)','transwire', r.qty, '線材');

  // 結構（背板螺絲，放回結構分組）
  if(r.cai>0){
    var screwQty = Math.ceil((backH+backW)*2/20) * r.qty;
    addPart('背板螺絲 (自攻)','screw', screwQty, '結構');
  }

  // 排序（v9.9 新順序）：框 → 附件 → 滑軌 → 模組 → 電子 → 線材 → 膠化 → 結構
  var CAT_ORDER = ['框','附件','滑軌','模組','電子','線材','膠化','結構'];
  mats.sort(function(a,b){
    return CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat);
  });

  // ── 工時明細 ──
  var works=[];
  works.push({n:'01. 前置作業',         u:'台', q:r.qty, t:parts.t01||0.33});
  works.push({n:'04. 組鋁框彎角',       u:'台', q:r.qty, t:parts.t04||1});
  works.push({n:'02. 模組拼接打膠',     u:'片', q:r.D,   t:parts.t02||1.01});
  works.push({n:'05. 模組上架',         u:'片', q:r.D,   t:parts.t05||0.5});
  works.push({n:'07. 電線固定黏片',     u:'片', q:r.D,   t:parts.t07||0.233});
  works.push({n:'10+13+14. 電源器全程', u:'顆', q:r.pwrN,t:parts.t10||5.867});
  works.push({n:'11. 上排線',           u:'條', q:r.D,   t:parts.t11||0.2});
  works.push({n:'12. 上 DC 電源線',     u:'條', q:r.D,   t:parts.t12||0.2});
  works.push({n:'15+16. 控制+送電',     u:'台', q:r.qty, t:parts.t16||5.5});
  works.push({n:'17. 貼標拍照',         u:'顆', q:r.pwrN,t:parts.t17||1.5});
  if(r.cai>0) works.push({n:'19. 上背板', u:'才', q:r.cai, t:parts.t19||0.25});
  works.push({n:'包裝',                 u:'台', q:r.qty, t:parts.t_pack||0});

  var matSub=0; mats.forEach(function(m){matSub+=m.sub;});
  var workMin=0; works.forEach(function(w){w.sub=w.q*w.t; workMin+=w.sub;});
  // v9.1：工時成本改用「積分 × 22 (委外工資)」，取代原本的「分/60 × 時薪 350」
  var workCost = (r.kpi||0) * sp;
  var totalCost = matSub + workCost;

  // 材料細批文字（給 Ragic 1002850 欄位）
  var detailText='【材料明細】\n';
  mats.forEach(function(m){
    detailText+=m.n+' × '+m.q+' × $'+(typeof m.u==='number'?m.u.toFixed(2):m.u)+' = $'+Math.round(m.sub)+'\n';
  });
  detailText+='材料小計 $'+Math.round(matSub)+'\n\n【工時明細】\n';
  works.forEach(function(w){
    detailText+=w.n+' '+(typeof w.q==='number'?w.q.toFixed(1):w.q)+' '+w.u+' × '+w.t+' = '+w.sub.toFixed(1)+' 分\n';
  });
  detailText+='工時小計 '+workMin.toFixed(1)+' 分\n';
  detailText+='工時成本（'+(r.kpi||0).toFixed(1)+' 積分 × $'+sp+' = $'+Math.round(workCost)+'）\n';
  detailText+='\n總成本 = 材料 $'+Math.round(matSub)+' + 工時 $'+Math.round(workCost)+' = $'+Math.round(totalCost);

  return {
    mats:mats, works:works,
    matSub:matSub, workMin:workMin, workCost:workCost, totalCost:totalCost,
    detailText:detailText, sp:sp
  };
}
