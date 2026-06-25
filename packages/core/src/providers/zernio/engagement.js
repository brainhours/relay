/**
 * ZernioEngagementManager — platform-specific engagement helpers that don't fit
 * the posting / inbox / comments buckets: Twitter actions, Reddit discovery,
 * Discord server ops, Instagram stories, and LinkedIn @mention resolution.
 */
class ZernioEngagementManager {
  constructor(provider) {
    this.provider = provider;
  }

  // ── Twitter / X ───────────────────────────────────────────────────────────────
  twitterRetweet(body) { return this.provider.request({ method: 'POST', path: '/twitter/retweet', data: body }); }
  twitterBookmark(body) { return this.provider.request({ method: 'POST', path: '/twitter/bookmark', data: body }); }
  twitterFollow(body) { return this.provider.request({ method: 'POST', path: '/twitter/follow', data: body }); }

  // ── Reddit ───────────────────────────────────────────────────────────────────
  redditSearch(params = {}) { return this.provider.request({ method: 'GET', path: '/reddit/search', params }); }
  redditFeed(params = {}) { return this.provider.request({ method: 'GET', path: '/reddit/feed', params }); }

  // ── Instagram stories ──────────────────────────────────────────────────────────
  instagramStories(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/instagram/stories`, params });
  }
  instagramStoryInsights(accountId, storyId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/instagram/stories/${encodeURIComponent(storyId)}/insights`, params });
  }

  // ── LinkedIn mentions ──────────────────────────────────────────────────────────
  /**
   * Resolve LinkedIn person/organization profile URLs to URNs + the
   * `mentionFormat` you embed directly in a post's `content` to create a real
   * @mention when publishing.
   */
  linkedinMentions(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/linkedin-mentions`, params });
  }

  // ── Discord ───────────────────────────────────────────────────────────────────
  discordChannels(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/discord-channels`, params });
  }
  discordSettings(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/discord-settings`, params });
  }
  discordDms(params = {}) {
    return this.provider.request({ method: 'GET', path: '/discord/dms', params });
  }
}

module.exports = { ZernioEngagementManager };
