import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';

interface ContextHint {
  title: string;
  description: string;
  suggestions: string[];
}

function getContextHint(pathname: string, role: string): ContextHint {
  // NP role contexts
  if (role === 'np') {
    if (pathname.includes('/fleet')) return {
      title: 'Fleet Management',
      description: 'I can help you find and onboard couriers, check compliance status, or import your fleet from a spreadsheet.',
      suggestions: ['Find couriers in Chicago', 'Check fleet compliance', 'Import couriers from CSV'],
    };
    if (pathname.includes('/compliance')) return {
      title: 'Compliance Dashboard',
      description: 'I can help you track document expiries, identify non-compliant couriers, and manage required certifications.',
      suggestions: ['Show expiring documents', 'Who needs insurance renewal?', 'Compliance summary by courier'],
    };
    if (pathname.includes('/recruitment') && pathname.includes('/')) return {
      title: 'Recruitment Pipeline',
      description: 'I can help you manage your applicant pipeline, track stage progress, and streamline the hiring process.',
      suggestions: ['Show pipeline summary', 'Applicants pending review', 'How to add a new stage?'],
    };
    if (pathname.includes('/users')) return {
      title: 'User Management',
      description: 'I can help you set up user roles, import users in bulk, or review access permissions.',
      suggestions: ['What roles are available?', 'Import users from spreadsheet', 'Review user permissions'],
    };
    if (pathname.includes('/jobs')) return {
      title: 'Job Management',
      description: 'I can help you find available jobs, check delivery status, or optimise courier assignments.',
      suggestions: ['Show unassigned jobs', 'Check delivery performance', 'Optimise dispatch'],
    };
    if (pathname.includes('/settings')) return {
      title: 'Settings & Configuration',
      description: 'I can help you configure document types, recruitment stages, contracts, and platform integrations.',
      suggestions: ['How do I upgrade?', 'Configure document types', 'Set up recruitment stages'],
    };
    return {
      title: 'NP Dashboard',
      description: "I'm Auto-Mate, your AI assistant. I can help you manage your fleet, find jobs, or answer questions about the platform.",
      suggestions: ['Show fleet overview', 'Find available jobs', 'Check compliance status'],
    };
  }

  // Tenant role contexts
  if (pathname.includes('/compliance')) return {
    title: 'Compliance Dashboard',
    description: 'I can help you track document expiries, identify non-compliant couriers, and manage required certifications across your network.',
    suggestions: ['Show expiring documents', 'Who needs insurance renewal?', 'Compliance summary by courier'],
  };
  if (pathname.includes('/recruitment')) return {
    title: 'Recruitment Pipeline',
    description: 'I can help you manage your applicant pipeline, track stage progress, and streamline the hiring process.',
    suggestions: ['Show pipeline summary', 'Applicants pending review', 'How to add a new stage?'],
  };
  if (pathname.includes('/agents/onboarding') || pathname.includes('/onboarding')) return {
    title: 'Partner Onboarding',
    description: 'I can search the carrier registry to pre-fill partner details, verify association membership, or fast-track onboarding.',
    suggestions: ['Search for Metro Express', 'Verify ECA membership', 'What documents are needed?'],
  };
  if (pathname.includes('/agents/find')) return {
    title: 'Find Partners',
    description: 'I can help you search association directories, compare potential partners, and decide whether to quick-add or onboard them.',
    suggestions: ['Find carriers in Dallas', 'Show ECA members', 'Quick-add a new lead'],
  };
  if (pathname.includes('/agents')) return {
    title: 'Partner Directory',
    description: 'I can help you review partner coverage, open a partner workspace, or compare network partner readiness.',
    suggestions: ['Show pending NP candidates', 'Compare partner coverage', 'Open Phoenix partner details'],
  };
  if (pathname.includes('/np-management')) return {
    title: 'Network Partners',
    description: 'I can help you find potential network partners, review NP performance, or manage partner tiers.',
    suggestions: ['Find NPs in Phoenix', 'Compare NP performance', 'What is multi-client tier?'],
  };
  if (pathname.includes('/quotes')) return {
    title: 'Quote Requests',
    description: 'I can help you send quote requests to carriers, compare responses, or find the best match for a delivery.',
    suggestions: ['Send quote to all Chicago carriers', 'Compare active quotes', 'Find same-day carriers'],
  };
  if (pathname.includes('/associations')) return {
    title: 'Association Stats',
    description: 'I can help you analyse carrier data across ECA and CLDA, identify onboarding opportunities, or track conversion rates.',
    suggestions: ['Show ECA vs CLDA comparison', 'Carriers not yet onboarded', 'Top-rated carriers'],
  };
  return {
    title: 'Dashboard',
    description: "I'm Auto-Mate, your AI-powered discovery assistant. I have access to 821 pre-vetted carriers from ECA and CLDA. Ask me anything.",
    suggestions: ['Find carriers by location', 'Show all ECA members', 'Search by service type'],
  };
}

const STORAGE_KEY = 'automate-assistant-open';

function getMockResponse(userMsg: string, pathname: string): string {
  const msg = userMsg.toLowerCase();
  // Compliance-specific
  if (pathname.includes('/compliance')) {
    if (msg.includes('expir')) return '📋 You have 7 documents expiring in the next 30 days: 3 insurance certificates, 2 vehicle registrations, and 2 background checks. Want me to list them by courier?';
    if (msg.includes('insurance')) return '🔍 Found 3 couriers with insurance expiring soon:\n• Mike Torres — expires Mar 15\n• Sarah Chen — expires Mar 22\n• James Wilson — expires Apr 1\nShall I send renewal reminders?';
    if (msg.includes('summary') || msg.includes('overview')) return '✅ Fleet compliance: 84% compliant (42/50 couriers). 5 have expired documents, 3 are pending review. The most common gap is vehicle registration renewals.';
  }
  // Recruitment-specific
  if (pathname.includes('/recruitment')) {
    if (msg.includes('pipeline') || msg.includes('summary')) return '📊 Your recruitment pipeline:\n• New Applications: 12\n• Screening: 8\n• Interview: 5\n• Background Check: 3\n• Offer: 2\nAverage time-to-hire: 14 days.';
    if (msg.includes('pending') || msg.includes('review')) return '👀 5 applicants pending your review:\n• Jordan Lee — Applied 2 days ago\n• Alex Rivera — Applied 3 days ago\n• Pat Morgan — Applied 4 days ago\nWant me to show their details?';
    if (msg.includes('stage')) return '⚙️ You can manage recruitment stages in Settings → Recruitment Stages. Currently you have 5 stages configured. You can add, reorder, or rename them there.';
  }
  // Fleet-specific
  if (pathname.includes('/fleet')) {
    if (msg.includes('chicago') || msg.includes('find')) return '🗺️ Found 8 couriers in the Chicago area. 5 are active today, 2 are on scheduled leave, and 1 has an expired vehicle registration. Want me to filter by availability?';
    if (msg.includes('compliance')) return '📋 Fleet compliance overview: 84% of your couriers have all documents up to date. 8 need attention — shall I show you the details?';
    if (msg.includes('import') || msg.includes('csv')) return '📤 To import couriers, go to Fleet → Import or click the Import button above. I support CSV files with columns: Name, Email, Phone, Vehicle Type, License #. Need a template?';
  }
  // Settings-specific
  if (pathname.includes('/settings')) {
    if (msg.includes('upgrade')) return '⬆️ Upgrading to Multi-Client tier gives you: multi-tenant management, advanced analytics, API access, and priority support. Visit Settings → Subscription to upgrade.';
    if (msg.includes('document')) return '📄 Document Type settings let you define which documents are required for courier compliance. You can set expiry rules, make documents mandatory, and configure auto-reminders.';
    if (msg.includes('recruitment') || msg.includes('stage')) return '🔧 Recruitment Stage settings control your hiring pipeline. You can add custom stages, set required actions per stage, and configure automated notifications.';
  }
  // General
  if (msg.includes('help') || msg.includes('what can')) return "I'm Auto-Mate, your AI assistant for NightProwl Agent Management! I can help with fleet management, compliance tracking, recruitment pipelines, and more. Just ask!";
  return `I'm working on "${userMsg}". In production, this connects to the AI engine for real-time answers. For now, try one of the suggestion chips for a demo response!`;
}

export function AutoMateAssistant() {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { role } = useRole();

  const hint = getContextHint(location.pathname, role || "tenant");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(isOpen)); } catch {}
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);

    // Context-aware mock response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: getMockResponse(userMsg, location.pathname) },
      ]);
    }, 600 + Math.random() * 400);
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 z-50 ${
          isOpen
            ? 'bg-brand-dark text-white shadow-lg'
            : 'bg-brand-cyan text-brand-dark shadow-lg hover:shadow-cyan-glow hover:-translate-y-0.5'
        }`}
        title="Auto-Mate Assistant"
      >
        {isOpen ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <img src={import.meta.env.BASE_URL + 'auto-mate-icon.png'} alt="Auto-Mate" className="w-9 h-9 rounded-full" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] max-h-[500px] bg-white rounded-xl shadow-xl border border-border overflow-hidden z-50 flex flex-col animate-in">
          {/* Header */}
          <div className="bg-brand-dark px-5 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img src={import.meta.env.BASE_URL + 'auto-mate-icon-light.png'} alt="Auto-Mate" className="w-9 h-9 rounded-lg" />
              <div>
                <div className="text-white font-bold text-sm">Auto-Mate</div>
                <div className="text-white/50 text-xs">{hint.title}</div>
              </div>
            </div>
          </div>

          {/* Context description */}
          <div className="px-5 py-3 bg-surface-light border-b border-border-light text-sm text-text-secondary">
            {hint.description}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[120px] max-h-[220px]">
            {messages.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-4">
                Ask me anything or try a suggestion below
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <img src={import.meta.env.BASE_URL + 'auto-mate-icon.png'} alt="" className="w-6 h-6 rounded-full mr-2 mt-1 flex-shrink-0" />
                    )}
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-sm whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-brand-cyan text-brand-dark'
                          : 'bg-surface-light text-text-primary'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="px-5 py-2 border-t border-border-light flex-shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {hint.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setMessages(prev => [...prev, { role: "user", text: s }]); setTimeout(() => { setMessages(prev => [...prev, { role: "assistant", text: getMockResponse(s, location.pathname) }]); }, 600 + Math.random() * 400); }}
                  className="px-2.5 py-1 text-[11px] rounded-full bg-surface-light text-text-secondary hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Auto-Mate..."
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-cyan transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-cyan text-brand-dark hover:shadow-cyan-glow disabled:opacity-50 transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-in {
          animation: slideUp 0.2s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
