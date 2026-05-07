/**
 * Widget runs in the browser, not Node. Override the root config to declare
 * browser globals (window, document, localStorage, EventSource, WebSocket,
 * fetch, setTimeout, console, etc.) so eslint doesn't flag them as `no-undef`.
 *
 * The root `.eslintrc.js` has `env: { node: true }`; this file adds the
 * browser env on top for files under packages/webchat-widget/src.
 */
module.exports = {
  env: {
    browser: true,
    es2022: true
  }
};
