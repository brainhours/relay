/**
 * ZernioAnalyticsManager — content, account, per-platform & inbox analytics.
 *
 * Most endpoints take `{ accountId, dateFrom, dateTo, ... }` query params.
 * A generic `get(path, params)` escape hatch is provided for the long tail of
 * platform-specific analytics routes not wrapped explicitly here.
 */
class ZernioAnalyticsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** Generic analytics GET — pass a path relative to `/analytics`. */
  get(path, params = {}) {
    return this.provider.request({ method: 'GET', path: `/analytics${path}`, params });
  }

  /** Aggregate overview across accounts. */
  overview(params = {}) {
    return this.get('', params);
  }

  /** Daily metric time-series. */
  dailyMetrics(params = {}) {
    return this.get('/daily-metrics', params);
  }

  /** Best time to post recommendation. */
  bestTime(params = {}) {
    return this.get('/best-time', params);
  }

  /** Content decay (reach falloff over time). */
  contentDecay(params = {}) {
    return this.get('/content-decay', params);
  }

  /** Posting frequency stats. */
  postingFrequency(params = {}) {
    return this.get('/posting-frequency', params);
  }

  /** Post timeline. */
  postTimeline(params = {}) {
    return this.get('/post-timeline', params);
  }

  // Per-platform
  instagramAccountInsights(params = {}) { return this.get('/instagram/account-insights', params); }
  instagramFollowerHistory(params = {}) { return this.get('/instagram/follower-history', params); }
  instagramDemographics(params = {}) { return this.get('/instagram/demographics', params); }
  facebookPageInsights(params = {}) { return this.get('/facebook/page-insights', params); }
  youtubeChannelInsights(params = {}) { return this.get('/youtube/channel-insights', params); }
  youtubeDailyViews(params = {}) { return this.get('/youtube/daily-views', params); }
  youtubeVideoRetention(params = {}) { return this.get('/youtube/video-retention', params); }
  youtubeDemographics(params = {}) { return this.get('/youtube/demographics', params); }
  linkedinOrgAggregate(params = {}) { return this.get('/linkedin/org-aggregate-analytics', params); }
  tiktokAccountInsights(params = {}) { return this.get('/tiktok/account-insights', params); }
  googleBusinessPerformance(params = {}) { return this.get('/googlebusiness/performance', params); }
  googleBusinessSearchKeywords(params = {}) { return this.get('/googlebusiness/search-keywords', params); }

  // Inbox analytics
  inboxVolume(params = {}) { return this.get('/inbox/volume', params); }
  inboxHeatmap(params = {}) { return this.get('/inbox/heatmap', params); }
  inboxSourceBreakdown(params = {}) { return this.get('/inbox/source-breakdown', params); }
  inboxResponseTime(params = {}) { return this.get('/inbox/response-time', params); }
  inboxTopAccounts(params = {}) { return this.get('/inbox/top-accounts', params); }
  inboxConversations(params = {}) { return this.get('/inbox/conversations', params); }
}

module.exports = { ZernioAnalyticsManager };
