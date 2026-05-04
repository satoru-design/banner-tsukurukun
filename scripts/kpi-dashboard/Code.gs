/**
 * 勝ちバナー作る君 KPI Daily Aggregator
 *
 * 毎朝 8:00 JST に実行 → 前日 (JST) の KPI を Google Sheets に追記。
 * ファイブポイントデトックスの daily KPI 形式を踏襲（売上 / 広告 / ファネル / プラン別 / memo）。
 *
 * 自動取得:
 *   - Stripe API: Sales / 決済件数 / プラン別売上 / プラン別 CV / 累計 Paid
 *   - autobanner.jp/api/admin/kpi: 新規 Free 登録 / 累計 / 生成枚数 / プラン別生成
 *
 * 手動入力 (Phase 1):
 *   - Cost (Meta 広告費)  → Phase 2 で Meta Ads API 自動化
 *   - imp / click          → 同上
 *   - LP 訪問 (UU)         → Phase 2 で GA4 API 自動化
 *
 * 自動計算:
 *   - ROAS = Sales / Cost
 *   - CTR = click / imp
 *   - CPC = Cost / click
 *   - 新規Free CPA = Cost / 新規Free登録
 *   - 新規Free CVR = 新規Free登録 / LP訪問
 *   - 有料転換 CPA = Cost / 新規Paid
 *   - 有料転換 CVR = 新規Paid / 新規Free登録
 *
 * Setup: SETUP.md 参照
 */

// ===== Script Properties から設定読込 =====
const PROP = PropertiesService.getScriptProperties();
const STRIPE_KEY = PROP.getProperty('STRIPE_LIVE_KEY');
const KPI_API_URL = PROP.getProperty('KPI_API_URL');
const KPI_SECRET = PROP.getProperty('ADMIN_KPI_SECRET');
const SHEET_ID = PROP.getProperty('SHEET_ID');
const SHEET_NAME = PROP.getProperty('SHEET_NAME') || 'KPI';

// ===== 列定義 (ファイブポイントデトックス様式踏襲) =====
const COLUMNS = [
  // 日付・売上
  { key: 'date',                label: 'date',           auto: true },
  { key: 'salesTotal',          label: 'Sales',          auto: true,  format: '"¥"#,##0' },
  { key: 'cost',                label: 'Cost',           auto: false, format: '"¥"#,##0' },
  { key: 'roas',                label: 'ROAS',           auto: true,  format: '0.0%' },

  // AD_meta (Phase 2 で自動化、初期は手動)
  { key: 'imp',                 label: 'imp',            auto: false, format: '#,##0' },
  { key: 'click',               label: 'click',          auto: false, format: '#,##0' },
  { key: 'ctr',                 label: 'CTR',            auto: true,  format: '0.00%' },
  { key: 'cpc',                 label: 'CPC',            auto: true,  format: '"¥"#,##0' },

  // ファネル: 新規Free登録
  { key: 'visitsUu',            label: 'LP訪問(UU)',     auto: false, format: '#,##0' },
  { key: 'newFreeSignup',       label: 'Free登録CV',     auto: true,  format: '#,##0' },
  { key: 'freeCpa',             label: 'Free CPA',       auto: true,  format: '"¥"#,##0' },
  { key: 'freeCvr',             label: 'Free Cvr',       auto: true,  format: '0.00%' },

  // ファネル: 有料転換
  { key: 'newPaid',             label: 'Paid CV',        auto: true,  format: '#,##0' },
  { key: 'paidCpa',             label: 'Paid CPA',       auto: true,  format: '"¥"#,##0' },
  { key: 'paidCvr',             label: 'Paid Cvr',       auto: true,  format: '0.00%' },

  // プラン別 新規 (各プランの当日新規 sales と cv 件数)
  { key: 'starterSales',        label: 'Starter売上',    auto: true,  format: '"¥"#,##0' },
  { key: 'starterCv',           label: 'Starter cv',     auto: true,  format: '#,##0' },
  { key: 'proSales',            label: 'Pro売上',        auto: true,  format: '"¥"#,##0' },
  { key: 'proCv',                label: 'Pro cv',        auto: true,  format: '#,##0' },
  { key: 'businessSales',       label: 'Business売上',   auto: true,  format: '"¥"#,##0' },
  { key: 'businessCv',           label: 'Business cv',   auto: true,  format: '#,##0' },

  // 退会
  { key: 'cancelled',           label: '退会予約',       auto: true,  format: '#,##0' },

  // 累計アクティブ Paid
  { key: 'cumStarter',          label: '累Starter',      auto: true,  format: '#,##0' },
  { key: 'cumPro',               label: '累Pro',         auto: true,  format: '#,##0' },
  { key: 'cumBusiness',         label: '累Business',     auto: true,  format: '#,##0' },

  // 利用状況
  { key: 'genTotal',            label: '生成枚数',       auto: true,  format: '#,##0' },
  { key: 'genFree',              label: '生成(Free)',    auto: true,  format: '#,##0' },
  { key: 'genStarter',          label: '生成(Starter)',  auto: true,  format: '#,##0' },
  { key: 'genPro',               label: '生成(Pro)',     auto: true,  format: '#,##0' },
  { key: 'genBusiness',         label: '生成(Business)', auto: true,  format: '#,##0' },

  // memo
  { key: 'memo',                label: 'memo',           auto: false },
];

// ===== メイン =====
function dailyKpiUpdate() {
  if (!STRIPE_KEY || !KPI_API_URL || !KPI_SECRET || !SHEET_ID) {
    throw new Error('Script Properties 未設定: STRIPE_LIVE_KEY / KPI_API_URL / ADMIN_KPI_SECRET / SHEET_ID');
  }

  const dateStr = getYesterdayJst();
  Logger.log('[KPI] fetching for date=' + dateStr);

  const dbData = fetchKpiApi(dateStr);
  const stripeData = fetchStripeData(dateStr);

  // 行データ組み立て
  const newFree = dbData.users.newSignupsYesterday || 0;
  const newPaid = dbData.subscriptions.newPaidYesterday || 0;

  const row = {
    date: dateStr,
    salesTotal: stripeData.chargesTotal,
    cost: '', // 手動入力
    roas: '', // 手動入力後 自動計算 (Sheets 数式)

    imp: '', click: '', ctr: '', cpc: '',
    visitsUu: '',
    newFreeSignup: newFree,
    freeCpa: '', // Cost / newFree (Sheets 数式)
    freeCvr: '', // newFree / visitsUu

    newPaid: newPaid,
    paidCpa: '', // Cost / newPaid
    paidCvr: newFree > 0 ? newPaid / newFree : 0,

    starterSales: stripeData.byPlan.starter.sales,
    starterCv: stripeData.byPlan.starter.count,
    proSales: stripeData.byPlan.pro.sales,
    proCv: stripeData.byPlan.pro.count,
    businessSales: stripeData.byPlan.business.sales,
    businessCv: stripeData.byPlan.business.count,

    cancelled: dbData.subscriptions.cancelledYesterday || 0,

    cumStarter: dbData.subscriptions.activeByPlan.starter || 0,
    cumPro: dbData.subscriptions.activeByPlan.pro || 0,
    cumBusiness: dbData.subscriptions.activeByPlan.business || 0,

    genTotal: dbData.generations.totalYesterday || 0,
    genFree: dbData.generations.byPlan.free || 0,
    genStarter: dbData.generations.byPlan.starter || 0,
    genPro: dbData.generations.byPlan.pro || 0,
    genBusiness: dbData.generations.byPlan.business || 0,

    memo: '',
  };

  appendRow(row);
  Logger.log('[KPI] DONE');
}

// ===== KPI API (autobanner.jp) =====
function fetchKpiApi(dateStr) {
  const res = UrlFetchApp.fetch(KPI_API_URL + '?date=' + dateStr, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + KPI_SECRET },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('KPI API failed: ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 200));
  }
  return JSON.parse(res.getContentText());
}

// ===== Stripe API =====
function fetchStripeData(dateStr) {
  const startUtc = Math.floor(new Date(dateStr + 'T00:00:00+09:00').getTime() / 1000);
  const endUtc = startUtc + 24 * 60 * 60;

  // 当日 charges
  let chargesTotal = 0;
  let hasMore = true;
  let startingAfter = null;
  while (hasMore) {
    const url = 'https://api.stripe.com/v1/charges?limit=100&created[gte]=' + startUtc + '&created[lt]=' + endUtc + (startingAfter ? '&starting_after=' + startingAfter : '');
    const data = stripeGet(url);
    if (!data) break;
    for (const c of data.data) {
      if (c.paid && c.status === 'succeeded') chargesTotal += c.amount;
    }
    hasMore = data.has_more;
    startingAfter = hasMore && data.data.length > 0 ? data.data[data.data.length - 1].id : null;
    if (!startingAfter) hasMore = false;
  }

  // 当日新規 subscription を プラン別に集計
  const byPlan = {
    starter: { sales: 0, count: 0 },
    pro: { sales: 0, count: 0 },
    business: { sales: 0, count: 0 },
  };
  hasMore = true;
  startingAfter = null;
  while (hasMore) {
    const url = 'https://api.stripe.com/v1/subscriptions?limit=100&created[gte]=' + startUtc + '&created[lt]=' + endUtc + (startingAfter ? '&starting_after=' + startingAfter : '');
    const data = stripeGet(url);
    if (!data) break;
    for (const sub of data.data) {
      const baseItem = sub.items.data.find(function (i) {
        return i.price.recurring && i.price.recurring.usage_type === 'licensed';
      });
      if (!baseItem) continue;
      const amount = baseItem.price.unit_amount;
      let plan = null;
      if (amount === 3980) plan = 'starter';
      else if (amount === 14800) plan = 'pro';
      else if (amount === 39800) plan = 'business';
      if (plan) {
        byPlan[plan].sales += amount;
        byPlan[plan].count += 1;
      }
    }
    hasMore = data.has_more;
    startingAfter = hasMore && data.data.length > 0 ? data.data[data.data.length - 1].id : null;
    if (!startingAfter) hasMore = false;
  }

  return { chargesTotal, byPlan };
}

function stripeGet(url) {
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + STRIPE_KEY },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('Stripe API failed: ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 200));
    return null;
  }
  return JSON.parse(res.getContentText());
}

// ===== Sheets 操作 =====
function appendRow(rowObj) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // ヘッダー初期化
  if (sheet.getLastRow() === 0) {
    initSheet(sheet);
  }

  // 同日付既存行の検索
  const data = sheet.getDataRange().getValues();
  let existingRowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === rowObj.date) {
      existingRowIdx = i + 1;
      break;
    }
  }

  // 値配列構築
  const values = COLUMNS.map(function (c) { return rowObj[c.key]; });

  if (existingRowIdx > 0) {
    // 既存行 update：手動入力カラム (auto:false) は既存値を保持
    const existingRow = data[existingRowIdx - 1];
    const merged = COLUMNS.map(function (c, idx) {
      if (!c.auto && existingRow[idx] !== '' && existingRow[idx] != null) {
        return existingRow[idx]; // 手動入力済みなら維持
      }
      return values[idx];
    });
    sheet.getRange(existingRowIdx, 1, 1, merged.length).setValues([merged]);
    Logger.log('[KPI] updated row ' + existingRowIdx + ' (preserving manual fields)');
  } else {
    sheet.appendRow(values);
    const newRowIdx = sheet.getLastRow();
    // 数式列を入れる
    insertFormulas(sheet, newRowIdx);
    Logger.log('[KPI] appended row ' + newRowIdx);
  }
}

function initSheet(sheet) {
  const headers = COLUMNS.map(function (c) { return c.label; });
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1f2937').setFontColor('white').setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // 列幅 + フォーマット
  COLUMNS.forEach(function (c, idx) {
    const col = idx + 1;
    if (c.format) {
      sheet.getRange(2, col, 1000, 1).setNumberFormat(c.format);
    }
    sheet.setColumnWidth(col, 90);
  });
  sheet.setColumnWidth(1, 110); // date は広め
  sheet.setColumnWidth(COLUMNS.length, 200); // memo は広め
}

/**
 * 数式列を追加 (ROAS, CTR, CPC, FreeCPA, FreeCvr, PaidCPA, PaidCvr)
 * これらは Cost や imp が手動入力された後に再計算される
 */
function insertFormulas(sheet, rowIdx) {
  const r = rowIdx;
  // 列インデックス (1-based)
  const col = function (key) { return COLUMNS.findIndex(function (c) { return c.key === key; }) + 1; };

  // ROAS = Sales / Cost
  sheet.getRange(r, col('roas')).setFormula(`=IFERROR(${a1(r, col('salesTotal'))}/${a1(r, col('cost'))}, 0)`);
  // CTR = click / imp
  sheet.getRange(r, col('ctr')).setFormula(`=IFERROR(${a1(r, col('click'))}/${a1(r, col('imp'))}, 0)`);
  // CPC = Cost / click
  sheet.getRange(r, col('cpc')).setFormula(`=IFERROR(${a1(r, col('cost'))}/${a1(r, col('click'))}, 0)`);
  // Free CPA = Cost / Free登録CV
  sheet.getRange(r, col('freeCpa')).setFormula(`=IFERROR(${a1(r, col('cost'))}/${a1(r, col('newFreeSignup'))}, 0)`);
  // Free Cvr = Free登録CV / LP訪問
  sheet.getRange(r, col('freeCvr')).setFormula(`=IFERROR(${a1(r, col('newFreeSignup'))}/${a1(r, col('visitsUu'))}, 0)`);
  // Paid CPA = Cost / Paid CV
  sheet.getRange(r, col('paidCpa')).setFormula(`=IFERROR(${a1(r, col('cost'))}/${a1(r, col('newPaid'))}, 0)`);
  // Paid Cvr = Paid CV / Free登録CV (set in JS already, but overwrite with formula for live update)
  sheet.getRange(r, col('paidCvr')).setFormula(`=IFERROR(${a1(r, col('newPaid'))}/${a1(r, col('newFreeSignup'))}, 0)`);
}

function a1(row, col) {
  // 1-based row/col → A1 notation
  let colStr = '';
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    colStr = String.fromCharCode(65 + m) + colStr;
    n = Math.floor((n - 1) / 26);
  }
  return colStr + row;
}

// ===== Helpers =====
function getYesterdayJst() {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  nowJst.setUTCHours(0, 0, 0, 0);
  nowJst.setUTCDate(nowJst.getUTCDate() - 1);
  const y = nowJst.getUTCFullYear();
  const m = String(nowJst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nowJst.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// ===== トリガー設定 =====
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'dailyKpiUpdate') ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger('dailyKpiUpdate').timeBased().atHour(8).everyDays(1).create();
  Logger.log('[KPI] daily 8:00 trigger created');
}

// ===== 手動テスト用 =====
function manualRun() {
  dailyKpiUpdate();
}
