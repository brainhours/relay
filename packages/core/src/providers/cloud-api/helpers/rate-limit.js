/**
 * Meta WhatsApp Cloud API messaging tier limits.
 *
 * Tiers: 250 → 1k → 10k → 100k → unlimited.
 * "Limit" is daily unique-conversations-initiated, not raw messages, but
 * Meta also tracks per-second throughput separately. The number stored on a
 * per-org `WhatsAppAccount.tier` is the daily limit.
 *
 * Apps should run their dispatcher BELOW the documented tier to leave headroom
 * (account quality scoring punishes hitting the cap repeatedly). 80% is a
 * defensible default.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/overview#messaging-limits
 */

/**
 * Compute the safe daily limit at which an app should pace its sends.
 *
 * Accepts:
 *   - numbers: 250, 1000, 10000, 100000, Infinity
 *   - strings: '250', '1000', 'TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED', 'unlimited'
 *     (Meta returns the TIER_* shape in webhooks and account info)
 *
 * @param {number|string|undefined} tier
 * @param {number} [marginPct=0.8]   - 0..1 — fraction of the tier the app will use
 * @returns {number} effective limit; Infinity for unlimited; 0 for missing/invalid
 */
function effectiveDailyLimit(tier, marginPct = 0.8) {
  if (tier === Infinity) return Infinity;
  if (tier == null) return 0;
  if (!Number.isFinite(marginPct) || marginPct <= 0) return 0;

  let numeric;
  if (typeof tier === 'number') {
    numeric = tier;
  } else {
    const s = String(tier).toUpperCase();
    if (s === 'UNLIMITED' || s.endsWith('_UNLIMITED')) return Infinity;

    // Match e.g. "10K", "100K", "1M", "TIER_10K", or plain "1000"
    const match = s.match(/(\d+)\s*([KMB]?)/);
    if (!match) return 0;
    const base = parseInt(match[1], 10);
    const mult = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'B' ? 1_000_000_000 : 1;
    numeric = base * mult;
  }

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric * marginPct);
}

module.exports = { effectiveDailyLimit };
