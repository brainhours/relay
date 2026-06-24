/**
 * Twilio channel-address helpers.
 *
 * Twilio identifies the channel by a prefix on the `To`/`From` address: SMS/MMS
 * have none, chat channels do (`whatsapp:`, `messenger:`). These helpers live in
 * their own module so both `client.js` and `messaging.js`/`webhooks.js` can use
 * them without a circular `require`.
 */

/**
 * Channel prefixes Twilio uses on the `To`/`From` address.
 * SMS/MMS have no prefix; chat channels do.
 */
const CHANNEL_PREFIX = Object.freeze({
  sms: '',
  mms: '',
  whatsapp: 'whatsapp:',
  messenger: 'messenger:'
});

/**
 * Apply a channel prefix to an address if not already present.
 * `+5511999999999` + 'whatsapp' => `whatsapp:+5511999999999`.
 * @param {string} address
 * @param {'sms'|'mms'|'whatsapp'|'messenger'} [channel='sms']
 * @returns {string}
 */
function toChannelAddress(address, channel = 'sms') {
  if (!address) return address;
  const prefix = CHANNEL_PREFIX[String(channel).toLowerCase()] ?? '';
  if (!prefix) return address;
  return new RegExp(`^${prefix}`, 'i').test(address) ? address : `${prefix}${address}`;
}

/**
 * Split a Twilio address into `{ channel, address }`.
 * `whatsapp:+5511999999999` => { channel: 'whatsapp', address: '+5511999999999' }.
 * `+5511999999999`          => { channel: 'sms',      address: '+5511999999999' }.
 * @param {string} raw
 * @returns {{ channel: string, address: string }}
 */
function parseChannelAddress(raw) {
  if (!raw || typeof raw !== 'string') return { channel: 'sms', address: raw };
  const m = /^([a-z]+):(.*)$/i.exec(raw.trim());
  if (m) {
    const channel = m[1].toLowerCase();
    if (CHANNEL_PREFIX[channel] !== undefined && channel !== 'sms' && channel !== 'mms') {
      return { channel, address: m[2] };
    }
  }
  return { channel: 'sms', address: raw };
}

module.exports = { CHANNEL_PREFIX, toChannelAddress, parseChannelAddress };
