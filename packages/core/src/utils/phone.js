/**
 * Phone number utilities
 */

/**
 * Format a phone number for WhatsApp
 * Removes special characters and ensures proper format
 *
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
function formatWhatsAppNumber(phone) {
  if (!phone) return '';

  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading + if present (WhatsApp API sometimes doesn't want it)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Format a phone number for display
 *
 * @param {string} phone - Phone number
 * @param {string} [countryCode='BR'] - Country code for formatting
 * @returns {string} Formatted phone number
 */
function formatPhoneForDisplay(phone, countryCode = 'BR') {
  if (!phone) return '';

  const cleaned = phone.replace(/\D/g, '');

  // Brazilian format
  if (countryCode === 'BR') {
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
  }

  // Default international format
  if (cleaned.length > 10) {
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10)}`;
  }

  return phone;
}

/**
 * Extract country code from phone number
 *
 * @param {string} phone - Phone number with country code
 * @returns {string|null} Country code or null
 */
function extractCountryCode(phone) {
  if (!phone) return null;

  const cleaned = phone.replace(/\D/g, '');

  // Common country codes and their lengths
  const countryCodes = [
    { code: '1', length: 1 },    // US/Canada
    { code: '44', length: 2 },   // UK
    { code: '55', length: 2 },   // Brazil
    { code: '351', length: 3 },  // Portugal
    { code: '34', length: 2 },   // Spain
    { code: '49', length: 2 },   // Germany
    { code: '33', length: 2 },   // France
    { code: '39', length: 2 },   // Italy
    { code: '52', length: 2 },   // Mexico
    { code: '54', length: 2 },   // Argentina
    { code: '57', length: 2 },   // Colombia
    { code: '56', length: 2 }    // Chile
  ];

  for (const { code, length } of countryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10 + length) {
      return code;
    }
  }

  return null;
}

/**
 * Validate if a string looks like a phone number
 *
 * @param {string} phone - String to validate
 * @returns {boolean} True if it looks like a phone number
 */
function isValidPhoneNumber(phone) {
  if (!phone) return false;

  const cleaned = phone.replace(/\D/g, '');

  // Most phone numbers are between 10 and 15 digits
  return cleaned.length >= 10 && cleaned.length <= 15;
}

module.exports = {
  formatWhatsAppNumber,
  formatPhoneForDisplay,
  extractCountryCode,
  isValidPhoneNumber
};
