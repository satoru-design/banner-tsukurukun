/**
 * meta-autopause: Meta広告の自動PAUSE監視スクリプト
 *
 * Phase 3b (2026-05-11) for autobanner.jp の meta-ads-autopilot プロジェクト。
 *
 * 1時間毎にトリガーで monitorAndAutopause() を呼ぶ前提。
 */

// ===== 設定（スクリプトプロパティ） =====
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('META_SYSTEM_USER_TOKEN');
  var accountId = props.getProperty('META_AD_ACCOUNT_ID');
  var slackUrl = props.getProperty('SLACK_WEBHOOK_URL');
  var dryRun = props.getProperty('DRY_RUN') === 'true';
  if (!token) throw new Error('META_SYSTEM_USER_TOKEN not set in Script Properties');
  if (!accountId) throw new Error('META_AD_ACCOUNT_ID not set in Script Properties');
  return { token: token, accountId: accountId, slackUrl: slackUrl, dryRun: dryRun };
}

// ===== 閾値 =====
var THRESHOLDS = {
  cpaPausing: 9000,        // JPY
  cpaPausingDays: 3,       // 連続日数
  cpmPausing: 3500,
  ctrPausing: 0.008,       // 0.8%
  frequencyPausing: 3.5,
  cpaIncreaseProposal: 4500,
  cpaIncreaseProposalMinCv: 5,
  ctrIncreaseProposal: 0.025,
  frequencyIncreaseProposal: 1.8,
  learningPhaseHours: 72,
  learningPhaseMinCv: 10,
};

var META_API_VERSION = 'v23.0';

// ===== エントリポイント =====
function monitorAndAutopause() {
  var config = getConfig();
  var ads = listActiveAds_(config);
  var results = { pausedCount: 0, increaseProposalCount: 0, skippedLearning: 0, errors: [] };

  ads.forEach(function (ad) {
    try {
      var insights7d = getInsights_(config, ad.id, '7_days');
      var insights1d = getInsights_(config, ad.id, '1_day');

      // 学習期間判定
      var isLearning = isInLearningPhase_(ad, insights7d);
      if (isLearning) {
        results.skippedLearning++;
        return;
      }

      var decision = evaluateAd_(ad, insights7d, insights1d);

      if (decision.action === 'pause') {
        if (!config.dryRun) {
          pauseAd_(config, ad.id);
        }
        results.pausedCount++;
        notifySlack_(config, formatPauseMessage_(ad, decision, config.dryRun));
      } else if (decision.action === 'propose_increase') {
        results.increaseProposalCount++;
        notifySlack_(config, formatIncreaseProposalMessage_(ad, decision));
      }
    } catch (e) {
      results.errors.push({ ad_id: ad.id, error: String(e) });
      Logger.log('Error processing ad ' + ad.id + ': ' + e);
    }
  });

  // サマリ通知（actionable な変化があったときだけ）
  if (results.pausedCount > 0 || results.increaseProposalCount > 0 || results.errors.length > 0) {
    notifySlack_(config, formatSummaryMessage_(results, ads.length, config.dryRun));
  }

  Logger.log('monitorAndAutopause done: ' + JSON.stringify(results));
  return results;
}

// ===== Meta API ヘルパー =====
function listActiveAds_(config) {
  var url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + config.accountId
    + '/ads?fields=id,name,status,effective_status,created_time,adset{id,name}&limit=100&access_token=' + config.token;
  // ACTIVE のみフィルタしたいが API のクエリで指定。簡略化のため取得後 client filter
  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('listActiveAds failed: ' + resp.getResponseCode() + ' ' + resp.getContentText());
  }
  var data = JSON.parse(resp.getContentText());
  return (data.data || []).filter(function (ad) {
    return ad.effective_status === 'ACTIVE';
  });
}

function getInsights_(config, adId, dateRange) {
  // dateRange: '1_day' | '7_days' (Meta API expects different formats; we map)
  var preset = dateRange === '1_day' ? 'yesterday' : 'last_7d';
  var url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + adId
    + '/insights?date_preset=' + preset
    + '&fields=spend,impressions,clicks,ctr,cpm,frequency,actions'
    + '&access_token=' + config.token;
  var resp = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('getInsights failed for ' + adId + ': ' + resp.getResponseCode());
  }
  var data = JSON.parse(resp.getContentText());
  return (data.data && data.data[0]) || { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpm: 0, frequency: 0, actions: [] };
}

function pauseAd_(config, adId) {
  var url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + adId
    + '?status=PAUSED&access_token=' + config.token;
  var resp = UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('pauseAd failed for ' + adId + ': ' + resp.getResponseCode() + ' ' + resp.getContentText());
  }
}

// ===== 判定ロジック =====
function isInLearningPhase_(ad, insights7d) {
  var createdAt = new Date(ad.created_time).getTime();
  var ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
  if (ageHours < THRESHOLDS.learningPhaseHours) return true;
  var cv = getConversionCount_(insights7d);
  return cv < THRESHOLDS.learningPhaseMinCv;
}

function getConversionCount_(insights) {
  if (!insights.actions || !insights.actions.length) return 0;
  // Meta API actions array: 'lead', 'complete_registration', 'purchase' などをCV扱い
  var cvActions = ['lead', 'complete_registration', 'purchase', 'subscribe', 'start_trial'];
  var total = 0;
  insights.actions.forEach(function (a) {
    if (cvActions.indexOf(a.action_type) >= 0) {
      total += Number(a.value) || 0;
    }
  });
  return total;
}

function evaluateAd_(ad, insights7d, insights1d) {
  var cv7d = getConversionCount_(insights7d);
  var spend7d = Number(insights7d.spend) || 0;
  var cpa7d = cv7d > 0 ? spend7d / cv7d : null;
  var freq = Number(insights7d.frequency) || 0;
  var ctr = Number(insights7d.ctr) || 0;
  var cpm = Number(insights7d.cpm) || 0;

  // PAUSE 判定
  if (freq > THRESHOLDS.frequencyPausing) {
    return { action: 'pause', reason: 'frequency_over', detail: { freq: freq } };
  }
  if (cpa7d !== null && cpa7d > THRESHOLDS.cpaPausing) {
    return { action: 'pause', reason: 'cpa_over', detail: { cpa: cpa7d } };
  }
  if (cpm > THRESHOLDS.cpmPausing) {
    return { action: 'pause', reason: 'cpm_over', detail: { cpm: cpm } };
  }
  if (ctr < THRESHOLDS.ctrPausing && Number(insights7d.impressions) > 5000) {
    return { action: 'pause', reason: 'ctr_under', detail: { ctr: ctr } };
  }

  // 増額提案判定
  if (cpa7d !== null && cpa7d < THRESHOLDS.cpaIncreaseProposal && cv7d >= THRESHOLDS.cpaIncreaseProposalMinCv) {
    return { action: 'propose_increase', reason: 'cpa_efficient', detail: { cpa: cpa7d, cv: cv7d } };
  }

  return { action: 'none', reason: 'within_thresholds' };
}

// ===== Slack 通知 =====
function notifySlack_(config, blocks) {
  if (!config.slackUrl) return;
  UrlFetchApp.fetch(config.slackUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ blocks: blocks }),
    muteHttpExceptions: true,
  });
}

function formatPauseMessage_(ad, decision, dryRun) {
  var dryRunTag = dryRun ? ' [DRY_RUN]' : '';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Auto PAUSE' + dryRunTag },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Ad*: `' + ad.id + '` ' + ad.name + '\n*Reason*: ' + decision.reason + '\n*Detail*: `' + JSON.stringify(decision.detail) + '`',
      },
    },
  ];
}

function formatIncreaseProposalMessage_(ad, decision) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Increase Proposal (manual review)' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Ad*: `' + ad.id + '` ' + ad.name + '\n*CPA*: ¥' + Math.round(decision.detail.cpa) + ' / *CV*: ' + decision.detail.cv + '\n→ 20%以内の予算増額検討',
      },
    },
  ];
}

function formatSummaryMessage_(results, totalAds, dryRun) {
  var dryRunTag = dryRun ? ' [DRY_RUN]' : '';
  return [
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'monitorAndAutopause' + dryRunTag + ' done: ' + results.pausedCount + ' paused, '
            + results.increaseProposalCount + ' proposals, ' + results.skippedLearning + ' learning, '
            + results.errors.length + ' errors / ' + totalAds + ' total active ads',
        },
      ],
    },
  ];
}

// ===== テスト関数（手動実行用） =====
function testRun() {
  var config = getConfig();
  Logger.log('Config loaded. dryRun=' + config.dryRun);
  var ads = listActiveAds_(config);
  Logger.log('Active ads: ' + ads.length);
  if (ads.length === 0) return;
  var insights = getInsights_(config, ads[0].id, '7_days');
  Logger.log('First ad insights: ' + JSON.stringify(insights));
  var decision = evaluateAd_(ads[0], insights, getInsights_(config, ads[0].id, '1_day'));
  Logger.log('Decision: ' + JSON.stringify(decision));
}
