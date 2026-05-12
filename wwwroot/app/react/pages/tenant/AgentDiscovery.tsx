import React, { useState, useRef, useEffect } from 'react';
import { ChatMessageBubble } from '@/components/common/ChatMessage';
import { AssociationBadge } from '@/components/common/AssociationBadge';
import type { ChatMessage, CarrierSearchResult, AssociationType } from '@/types';

// Mock carrier data for demo
const mockCarriers: CarrierSearchResult[] = [
  { id: 1, name: 'Metro Express Couriers', city: 'Chicago', state: 'IL', phone: '+1 312-555-0101', services: ['Same Day', 'Next Day'], certifications: ['ISO 9001'], association: 'ECA', rating: 4.8 },
  { id: 2, name: 'Lone Star Logistics', city: 'Dallas', state: 'TX', phone: '+1 214-555-0202', services: ['Same Day', 'Overnight'], certifications: ['Dangerous Goods'], association: 'CLDA', rating: 4.5 },
  { id: 3, name: 'Capital City Express', city: 'Dallas', state: 'TX', phone: '+1 404-555-0303', services: ['Same Day', 'Scheduled'], certifications: [], association: 'ECA', rating: 4.2 },
  { id: 4, name: 'Sunbelt Express', city: 'Phoenix', state: 'AZ', phone: '+1 602-555-0404', services: ['Next Day', 'Scheduled'], certifications: ['ISO 9001'], association: 'CLDA', rating: 4.6 },
  { id: 5, name: 'Mile High Delivery', city: 'Denver', state: 'CO', phone: '+1 720-555-0505', services: ['Same Day'], certifications: [], association: 'ECA', rating: 4.0 },
];

export function AgentDiscovery() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Auto-Mate, your AI-powered partner discovery assistant. I have access to 821 pre-loaded carriers from ECA and CLDA associations. Ask me to find carriers by location, service type, or coverage area.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const query = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Simulate AI search response
    setTimeout(() => {
      const lq = query.toLowerCase();
      const results = mockCarriers.filter(
        (c) =>
          c.city.toLowerCase().includes(lq) ||
          c.state.toLowerCase().includes(lq) ||
          c.services.some((s) => s.toLowerCase().includes(lq)) ||
          c.name.toLowerCase().includes(lq) ||
          c.association.toLowerCase().includes(lq) ||
          lq.includes('all') || lq.includes('find') || lq.includes('show')
      );

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: results.length > 0
          ? `Found ${results.length} carrier${results.length > 1 ? 's' : ''} matching your search. Here are the results:`
          : "I couldn't find carriers matching that criteria. Try searching by city (e.g., Chicago), service type (e.g., 'Same Day'), or association (e.g., 'ECA').",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        carrierResults: results.length > 0 ? results : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1200);
  };

  const handleQuoteRequest = (carrier: CarrierSearchResult) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `✅ Quote request sent to ${carrier.name}. They'll receive a notification and can respond through the quotes.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp}>
            {msg.carrierResults && (
              <div className="grid grid-cols-1 gap-3 mt-2">
                {msg.carrierResults.map((carrier) => (
                  <CarrierCard key={carrier.id} carrier={carrier} onQuoteRequest={handleQuoteRequest} />
                ))}
              </div>
            )}
          </ChatMessageBubble>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 ml-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-brand-cyan flex items-center justify-center text-xs font-bold text-white">
              AM
            </div>
            <div className="bg-white shadow-sm rounded-lg px-4 py-3 text-sm text-text-muted">
              <span className="animate-pulse">Searching carriers...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-4 border-t border-border-light">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Auto-Mate to find carriers... (e.g., 'Find same-day carriers in Chicago')"
            className="flex-1 px-4 py-3 text-base border-2 border-border rounded-full bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow hover:-translate-y-px active:translate-y-0 disabled:opacity-50 transition-all"
          >
            Send
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {['Same-day carriers in Chicago', 'ECA members', 'All carriers'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => { setInput(suggestion); }}
              className="px-3 py-1.5 text-xs font-normal rounded-full bg-surface-light text-text-secondary hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CarrierCard({ carrier, onQuoteRequest }: { carrier: CarrierSearchResult; onQuoteRequest: (c: CarrierSearchResult) => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-brand-cyan">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-text-primary">{carrier.name}</span>
            <AssociationBadge association={carrier.association} />
          </div>
          <div className="text-sm text-text-secondary mb-2">
            📍 {carrier.city}, {carrier.state} · 📞 {carrier.phone}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {carrier.services.map((s) => (
              <span key={s} className="px-2 py-0.5 text-xs font-normal rounded-full bg-badge-blue-bg text-badge-blue-text">
                {s}
              </span>
            ))}
            {carrier.certifications.map((c) => (
              <span key={c} className="px-2 py-0.5 text-xs font-normal rounded-full bg-badge-green-bg text-badge-green-text">
                {c}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-warning">★</span>
            <span className="font-bold text-text-primary">{carrier.rating}</span>
          </div>
        </div>
        <button
          onClick={() => onQuoteRequest(carrier)}
          className="px-4 py-2 text-sm font-bold rounded-full bg-brand-cyan text-brand-dark hover:shadow-cyan-glow transition-all flex-shrink-0"
        >
          Send Quote Request
        </button>
      </div>
    </div>
  );
}
