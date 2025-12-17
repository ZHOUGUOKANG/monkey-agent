import { describe, it, expect } from 'vitest';
import { buildAssistantMessage, buildToolResultMessage } from '../message-builders';

describe('message-builders', () => {
  describe('buildAssistantMessage', () => {
    it('should build assistant message with tool calls only', () => {
      const message = buildAssistantMessage([
        {
          toolCallId: 'call_123',
          toolName: 'getWeather',
          input: { city: 'Beijing' },
        },
      ]);

      expect(message.role).toBe('assistant');
      expect(Array.isArray(message.content)).toBe(true);
      expect(message.content).toHaveLength(1);
      expect(message.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'getWeather',
        input: { city: 'Beijing' },
      });
    });

    it('should build assistant message with text and tool calls', () => {
      const message = buildAssistantMessage(
        [
          {
            toolCallId: 'call_456',
            toolName: 'searchWeb',
            input: { query: 'AI news' },
          },
        ],
        'Let me search for that'
      );

      expect(message.role).toBe('assistant');
      expect(Array.isArray(message.content)).toBe(true);
      expect(message.content).toHaveLength(2);
      
      // First item should be text
      expect(message.content[0]).toMatchObject({
        type: 'text',
        text: 'Let me search for that',
      });
      
      // Second item should be tool-call
      expect(message.content[1]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_456',
        toolName: 'searchWeb',
      });
    });

    it('should handle empty input object', () => {
      const message = buildAssistantMessage([
        {
          toolCallId: 'call_789',
          toolName: 'getCurrentTime',
        },
      ]);

      expect(message.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_789',
        toolName: 'getCurrentTime',
        input: {},
      });
    });
  });

  describe('buildToolResultMessage', () => {
    it('should build tool result message with string result', () => {
      const message = buildToolResultMessage(
        { toolCallId: 'call_123', toolName: 'getWeather' },
        'Temperature: 22°C'
      );

      expect(message.role).toBe('tool');
      expect(Array.isArray(message.content)).toBe(true);
      expect(message.content).toHaveLength(1);
      expect(message.content[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'call_123',
        toolName: 'getWeather',
        output: {
          type: 'text',
          value: 'Temperature: 22°C',
        },
      });
    });

    it('should build tool result message with object result', () => {
      const message = buildToolResultMessage(
        { toolCallId: 'call_456', toolName: 'getWeather' },
        { temperature: 22, conditions: 'Sunny' }
      );

      expect(message.content[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'call_456',
        toolName: 'getWeather',
        output: {
          type: 'text',
          value: '{"temperature":22,"conditions":"Sunny"}',
        },
      });
    });

    it('should build tool result message with error flag', () => {
      const message = buildToolResultMessage(
        { toolCallId: 'call_789', toolName: 'failingTool' },
        'Connection timeout',
        true // isError
      );

      expect(message.content[0]).toMatchObject({
        type: 'tool-result',
        toolCallId: 'call_789',
        toolName: 'failingTool',
        output: {
          type: 'text',
          value: 'Connection timeout',
        },
        isError: true,
      });
    });

    it('should handle number result', () => {
      const message = buildToolResultMessage(
        { toolCallId: 'call_999', toolName: 'calculate' },
        42
      );

      expect(message.content[0].output).toMatchObject({
        type: 'text',
        value: '42',
      });
    });

    it('should preserve output with type and value fields', () => {
      const message = buildToolResultMessage(
        { toolCallId: 'call_111', toolName: 'customTool' },
        { type: 'custom', value: 'custom result' }
      );

      expect(message.content[0].output).toMatchObject({
        type: 'custom',
        value: 'custom result',
      });
    });
  });
});

