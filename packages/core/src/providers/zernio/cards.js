/**
 * Zernio — cards (carousel) for Instagram / Messenger DMs.
 *
 * A carousel is Meta's "generic template": up to 10 cards, each with a title,
 * an optional subtitle, an optional image and up to 3 buttons. On the Zernio
 * API it travels as `template: { type: 'generic', elements: [...] }` in
 * `POST /inbox/conversations/{id}/messages` (and in a comment private reply).
 *
 * What was measured against a live Instagram account (2026-11-21 / 23):
 *
 *  - Limits are enforced by Zernio itself (HTTP 400 `invalid_field_value`):
 *    title ≤ 80, subtitle ≤ 80, button title ≤ 20, 3 buttons per card.
 *  - A card may mix `url` and `postback` buttons.
 *  - `template` is exclusive with top-level `buttons` and `quickReplies`, and
 *    no `message` text goes with it.
 *  - The carousel only renders in the Instagram MOBILE app.
 *  - Image caveat: the send returns 200 even when Meta cannot display the
 *    image. A PNG served by a placeholder generator was silently dropped (the
 *    card rendered without image); JPEGs from a plain CDN rendered fine. Host
 *    card images yourself.
 *  - The outgoing echo (`message.sent`) and the REST read both come back with
 *    EMPTY text and no attachments; the cards live in
 *    `metadata.metaInteractive.template` — a sibling of `message` in the
 *    webhook envelope, inside the message in `getMessages`.
 *  - A tap on a `postback` button arrives as a regular `message.received`
 *    whose text is the button title, with
 *    `metadata: { postbackPayload, postbackTitle }` in the envelope.
 *
 * Everything here is pure (no I/O) so apps can validate before queueing.
 */

const CARD_LIMITS = Object.freeze({
  MAX_CARDS: 10,
  MAX_BUTTONS: 3,
  TITLE: 80,
  SUBTITLE: 80,
  BUTTON_TITLE: 20
});

/** Thrown by `buildCardsTemplate` — `code` is stable, `path` points at the offender. */
class ZernioCardsError extends Error {
  constructor(code, message, path) {
    super(message);
    this.name = 'ZernioCardsError';
    this.code = code;
    this.path = path || null;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function buildButton(b, path) {
  const title = str(b && b.title);
  if (!title) throw new ZernioCardsError('button_title_required', `${path}: button title is required`, path);
  if (title.length > CARD_LIMITS.BUTTON_TITLE) {
    throw new ZernioCardsError('button_title_too_long', `${path}: button title must be ${CARD_LIMITS.BUTTON_TITLE} characters or less`, path);
  }
  const url = str(b.url);
  const type = str(b.type) || (url ? 'url' : 'postback');
  if (type === 'url') {
    if (!/^https?:\/\//i.test(url)) throw new ZernioCardsError('button_url_invalid', `${path}: url button needs an http(s) url`, path);
    return { type: 'url', title, url };
  }
  if (type === 'postback') {
    // The payload is what comes back on the tap; default it to the title so a
    // caller that does not route by payload still gets something meaningful.
    return { type: 'postback', title, payload: str(b.payload) || title };
  }
  throw new ZernioCardsError('button_type_invalid', `${path}: button type must be "url" or "postback"`, path);
}

/**
 * Validate a list of cards and build the Zernio `template` object.
 *
 * @param {Array<Object>} cards
 * @param {string} cards[].title                 - required, ≤ 80
 * @param {string} [cards[].subtitle]            - ≤ 80
 * @param {string} [cards[].imageUrl]            - public http(s) URL (prefer a JPEG you host)
 * @param {Array<Object>} [cards[].buttons]      - up to 3:
 *        `{ type: 'url', title, url }` or `{ type: 'postback', title, payload? }`
 * @returns {{ type: 'generic', elements: Array<Object> }}
 * @throws {ZernioCardsError}
 */
function buildCardsTemplate(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new ZernioCardsError('cards_required', 'cards: at least one card is required', 'cards');
  }
  if (cards.length > CARD_LIMITS.MAX_CARDS) {
    throw new ZernioCardsError('too_many_cards', `cards: maximum ${CARD_LIMITS.MAX_CARDS} cards`, 'cards');
  }

  const elements = cards.map((c, i) => {
    const path = `cards[${i}]`;
    const title = str(c && c.title);
    if (!title) throw new ZernioCardsError('title_required', `${path}: title is required`, path);
    if (title.length > CARD_LIMITS.TITLE) {
      throw new ZernioCardsError('title_too_long', `${path}: title must be ${CARD_LIMITS.TITLE} characters or less`, path);
    }
    const subtitle = str(c.subtitle);
    if (subtitle.length > CARD_LIMITS.SUBTITLE) {
      throw new ZernioCardsError('subtitle_too_long', `${path}: subtitle must be ${CARD_LIMITS.SUBTITLE} characters or less`, path);
    }
    const imageUrl = str(c.imageUrl);
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      throw new ZernioCardsError('image_url_invalid', `${path}: imageUrl must be an http(s) url`, path);
    }
    const rawButtons = Array.isArray(c.buttons) ? c.buttons : [];
    if (rawButtons.length > CARD_LIMITS.MAX_BUTTONS) {
      throw new ZernioCardsError('too_many_buttons', `${path}: maximum ${CARD_LIMITS.MAX_BUTTONS} buttons per card`, path);
    }
    const buttons = rawButtons.map((b, j) => buildButton(b, `${path}.buttons[${j}]`));
    return {
      title,
      ...(subtitle ? { subtitle } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(buttons.length ? { buttons } : {})
    };
  });

  return { type: 'generic', elements };
}

/**
 * Read the cards back out of a `metaInteractive` object (webhook envelope
 * `metadata.metaInteractive` or REST `message.metadata.metaInteractive`).
 * Tolerant by design — it describes what was sent, it does not validate.
 *
 * @param {Object} metaInteractive
 * @returns {Array<Object>|null} `[{ title, subtitle?, imageUrl?, buttons? }]`, or null when not a carousel
 */
function parseCards(metaInteractive) {
  const tpl = metaInteractive && metaInteractive.template;
  if (!tpl || !Array.isArray(tpl.elements)) return null;

  const cards = tpl.elements.map((el) => {
    if (!el || typeof el !== 'object') return null;
    const title = str(el.title);
    const subtitle = str(el.subtitle);
    const imageUrl = str(el.imageUrl || el.image_url);
    const buttons = (Array.isArray(el.buttons) ? el.buttons : [])
      .map((b) => {
        const bTitle = str(b && b.title);
        if (!bTitle) return null;
        const url = str(b.url);
        return url
          ? { type: 'url', title: bTitle, url }
          : { type: 'postback', title: bTitle, ...(str(b.payload) ? { payload: str(b.payload) } : {}) };
      })
      .filter(Boolean);
    if (!title && !subtitle && !imageUrl && !buttons.length) return null;
    return {
      title,
      ...(subtitle ? { subtitle } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(buttons.length ? { buttons } : {})
    };
  }).filter(Boolean);

  return cards.length ? cards : null;
}

/** REST `getMessages` item → cards, or null. */
function cardsFromMessage(msg) {
  return parseCards(msg && msg.metadata && msg.metadata.metaInteractive);
}

module.exports = { CARD_LIMITS, ZernioCardsError, buildCardsTemplate, parseCards, cardsFromMessage };
