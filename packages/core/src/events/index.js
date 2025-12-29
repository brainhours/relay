/**
 * Events module - Normalized event handling
 */

const { EventTypes, ProviderTypes, NormalizedEvent } = require('./types');
const { MessagingEventEmitter, getDefaultEmitter } = require('./emitter');

module.exports = {
  EventTypes,
  ProviderTypes,
  NormalizedEvent,
  MessagingEventEmitter,
  getDefaultEmitter
};
