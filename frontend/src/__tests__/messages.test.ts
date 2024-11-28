import { IncomingMessageSchema } from '../types/interfaces';

describe('Message Validation', () => {
  it('should validate incoming messages', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      channelName: 'general',
      username: 'user1',
      type: 0,
      content: { text: 'Hello' },
      timestamp: '2024-03-14T12:00:00Z',
    };
    expect(() => IncomingMessageSchema.parse(validMessage)).not.toThrow();
  });

  it('should reject invalid incoming messages', () => {
    const invalidMessage = {
      // missing required fields
      channelName: 'general',
    };
    expect(() => IncomingMessageSchema.parse(invalidMessage)).toThrow();
  });
});
