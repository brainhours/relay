# Events

Relay normalizes events from all providers into a consistent format.

## Event Types

```javascript
const { EventTypes } = require('@relay/core');

// Message events
EventTypes.MESSAGE_RECEIVED    // Incoming message
EventTypes.MESSAGE_SENT        // Outgoing message
EventTypes.MESSAGE_DELIVERED   // Message was delivered
EventTypes.MESSAGE_READ        // Message was read
EventTypes.MESSAGE_EDITED      // Message was edited
EventTypes.MESSAGE_DELETED     // Message was deleted
EventTypes.MESSAGE_REACTION    // Reaction added/removed

// Relation events
EventTypes.RELATION_CREATED    // New connection/follow
EventTypes.RELATION_REMOVED    // Disconnection/unfollow

// Account events
EventTypes.ACCOUNT_CONNECTED      // Account connected
EventTypes.ACCOUNT_DISCONNECTED   // Account disconnected
EventTypes.ACCOUNT_STATUS_CHANGED // Account status update
```

## NormalizedEvent

All events are normalized to this structure:

```javascript
const { NormalizedEvent } = require('@relay/core');

const event = new NormalizedEvent({
  type: 'message.received',      // Event type
  provider: 'unipile',           // Provider name
  providerType: 'WHATSAPP',      // Channel type
  accountId: 'acc_123',          // Provider account ID
  chatId: 'chat_456',            // Chat ID
  messageId: 'msg_789',          // Message ID
  senderId: 'user_abc',          // Sender ID
  senderName: 'John Doe',        // Sender name
  content: 'Hello!',             // Message content
  timestamp: '2024-01-01T12:00:00Z',
  attachments: [],               // Normalized attachments
  metadata: {},                  // Provider-specific data
  raw: {}                        // Original payload
});

// Helper methods
event.isMessageEvent();    // true
event.isRelationEvent();   // false
event.isAccountEvent();    // false
event.getUniqueId();       // 'unipile:message.received:acc_123:msg_789'
event.toJSON();            // Plain object
```

## Provider Types

```javascript
const { ProviderTypes } = require('@relay/core');

ProviderTypes.LINKEDIN
ProviderTypes.WHATSAPP
ProviderTypes.INSTAGRAM
ProviderTypes.MESSENGER
ProviderTypes.TELEGRAM
ProviderTypes.TWITTER
ProviderTypes.EMAIL
ProviderTypes.SMS
```

## Event Emitter

Use `MessagingEventEmitter` for event-driven handling:

```javascript
const { MessagingEventEmitter, EventTypes } = require('@relay/core');

const emitter = new MessagingEventEmitter();

// Register handler for specific event
emitter.on(EventTypes.MESSAGE_RECEIVED, async (event, context) => {
  console.log('Message:', event.content);
  return { handled: true };
});

// Register handler for all events
emitter.onAll(async (event, context) => {
  console.log('Event:', event.type);
});

// Add middleware
emitter.use(async (event, context, next) => {
  console.log('Before handlers');
  next(); // Continue to handlers
});

// Emit event
const results = await emitter.emit(event, { db, services });

// Cleanup
emitter.off(EventTypes.MESSAGE_RECEIVED);
emitter.removeAllListeners();
```

## Default Emitter

Use the singleton emitter for simple applications:

```javascript
const { getDefaultEmitter, EventTypes } = require('@relay/core');

const emitter = getDefaultEmitter();
emitter.on(EventTypes.MESSAGE_RECEIVED, handler);
```
