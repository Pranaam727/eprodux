// ============================================================
// ChatAssistant – sustainability assistant panel
// Falls back to deterministic demo responses when the
// real /api/chat endpoint is not available.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { sendChatMessage } from '../services/api';
import { IS_DEMO } from '../services/api';

const SUGGESTIONS = [
  'Which rooms are wasting the most energy today?',
  'Why is the seminar hall flagged?',
  'What would happen if we reduced avoidable lighting hours?',
];

let msgIdCounter = 1;
function newId() { return `msg-${Date.now()}-${msgIdCounter++}`; }

const INITIAL_MESSAGE: ChatMessage = {
  id: newId(),
  role: 'assistant',
  content: IS_DEMO
    ? '👋 Hello! I\'m the Eprodux Sustainability Assistant (Demo Mode).\n\n' +
      'In demo mode, my responses are based on the simulated floor data — not real GenAI analysis. ' +
      'Try one of the suggested questions below, or type your own.'
    : '👋 Hello! I\'m the Eprodux Sustainability Assistant.\n\nAsk me anything about the building\'s current energy usage, alerts, or recommendations.',
  timestamp: new Date().toISOString(),
  isDemo: IS_DEMO,
};

export function ChatAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      isDemo: false,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(content, messages);
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        isDemo: IS_DEMO,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        content: '⚠️ The assistant is currently unavailable. Please check the backend connection.',
        timestamp: new Date().toISOString(),
        isDemo: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div role="region" aria-label="Sustainability AI assistant">
      <div className="section-header mb-4">
        <span className="section-title">🤖 AI Assistant</span>
        <div className="flex gap-2">
          {IS_DEMO && <span className="badge badge--demo">Demo Mode</span>}
          <span className="badge badge--gray">
            {IS_DEMO ? 'Deterministic responses' : 'Live'}
          </span>
        </div>
      </div>

      {IS_DEMO && (
        <div className="demo-banner mb-4">
          <span>⚗️</span>
          <span>
            Demo mode: responses are pre-written based on mock data. Connect{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>/api/chat</code>{' '}
            to enable real GenAI analysis.
          </span>
        </div>
      )}

      <div className="chat-panel">
        <div className="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map(msg => (
            <div
              key={msg.id}
              id={`chat-msg-${msg.id}`}
              className={`chat-message chat-message--${msg.role}`}
            >
              <div className="chat-bubble">{msg.content}</div>
              <div className={`chat-meta ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.role === 'assistant' ? '🤖 ' : '👤 '}
                {formatTime(msg.timestamp)}
                {msg.isDemo && ' · demo'}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message chat-message--assistant">
              <div className="chat-bubble" style={{ color: 'var(--text-muted)' }}>
                <span style={{ animation: 'pulse-dot 1s infinite' }}>●</span>
                <span style={{ animation: 'pulse-dot 1s 0.3s infinite' }}> ●</span>
                <span style={{ animation: 'pulse-dot 1s 0.6s infinite' }}> ●</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        <div className="chat-suggestions">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              id={`chat-suggest-${s.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
              className="chat-suggestion"
              onClick={() => handleSend(s)}
              disabled={isLoading}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="chat-input-row">
          <input
            id="chat-input"
            type="text"
            className="input"
            placeholder="Ask about energy, occupancy, alerts…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button
            id="chat-send"
            className="btn btn--primary btn--sm"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
