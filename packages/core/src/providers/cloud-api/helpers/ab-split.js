/**
 * Stable A/B variant assignment for mass send.
 *
 * Given a stable key (typically a contact ID), returns the same variant
 * deterministically across runs. This means pause/resume of a campaign
 * preserves variant assignment per contact.
 *
 * Algorithm: SHA-1(salt + ':' + key); use first byte modulo variant count.
 *
 * @example
 *   stableVariant('contact-42', { salt: 'campaign-x' })           // 'A' or 'B' (deterministic)
 *   stableVariant('contact-42', { salt: 'campaign-x', variants: ['A','B','C','D'] })
 */

const { createHash } = require('crypto');

/**
 * @param {string|number} key                  - stable identifier (e.g. contact ID)
 * @param {Object} [options]
 * @param {string[]} [options.variants=['A','B']]
 * @param {string} [options.salt='']           - additional input to differentiate campaigns
 * @returns {string}
 */
function stableVariant(key, { variants = ['A', 'B'], salt = '' } = {}) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('stableVariant: variants must be a non-empty array');
  }
  const buf = createHash('sha1').update(`${salt}:${String(key)}`).digest();
  return variants[buf[0] % variants.length];
}

module.exports = { stableVariant };
