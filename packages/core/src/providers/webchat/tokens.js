/**
 * Visitor token utilities.
 *
 * The token is the primary identifier of an anonymous visitor across page
 * loads. It is stored in the visitor's localStorage and sent on every
 * /:widgetKey/{message,history,identify} request.
 *
 * Default format: 32-byte hex (64 lowercase chars). Apps may override this
 * by passing `generateVisitorToken` to WebchatProvider.
 */

const crypto = require('crypto');

/**
 * Generate a 64-char hex visitor token.
 * @returns {string}
 */
function generateVisitorToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Cheap structural check used for early rejection on malformed input.
 * The real validation is the storage adapter looking up the token.
 *
 * @param {*} token
 * @returns {boolean}
 */
function isValidVisitorTokenFormat(token) {
  return typeof token === 'string' && /^[a-f0-9]{32,128}$/i.test(token);
}

module.exports = { generateVisitorToken, isValidVisitorTokenFormat };
