import React from 'react';
import type { ChatRole } from '@/types';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  timestamp: string;
  children?: React.ReactNode;
}

export function ChatMessageBubble({ role, content, timestamp, children }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-1'}`}>
        <div className="flex items-center gap-2 mb-1">
          {!isUser && (
            <div className="w-7 h-7 rounded-full bg-brand-cyan flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              AM
            </div>
          )}
          <span className="text-xs text-text-muted">{timestamp}</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            isUser
              ? 'bg-brand-cyan text-brand-dark rounded-br-sm'
              : 'bg-white shadow-sm text-text-primary rounded-bl-sm'
          }`}
        >
          {content}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
