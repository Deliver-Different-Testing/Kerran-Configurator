import React, { useState, useEffect, useRef } from 'react';
import { fleetService, type Fleet } from '@/services/np_fleetService';

// ─── Mock Data ───────────────────────────────────────────────

interface MockCourier {
  id: number;
  name: string;
  code: string;
  location: string;
  online: boolean;
  phone: string;
  fleetId: number;
}

interface ChatMessage {
  id: number;
  courierId: number;
  text: string;
  sent: boolean; // true = we sent it, false = courier sent it
  type: 1 | 2 | 3; // 1=App, 2=SMS, 3=Mixed
  timestamp: string;
  read: boolean;
}

interface BulkSent {
  id: number;
  text: string;
  date: string;
  type: 1 | 2 | 3;
  recipients: { courierId: number; name: string; status: 'delivered' | 'pending' }[];
}

interface IncomingReply {
  id: number;
  courierId: number;
  courierName: string;
  text: string;
  timestamp: string;
}

const MOCK_COURIERS: MockCourier[] = [
  { id: 1, name: 'James Tua', code: 'JT-001', location: 'Auckland', online: true, phone: '+64 21 555 0101', fleetId: 1 },
  { id: 2, name: 'Sarah Mitchell', code: 'SM-002', location: 'Auckland', online: false, phone: '+64 21 555 0102', fleetId: 1 },
  { id: 3, name: 'Aroha Nikora', code: 'AN-003', location: 'Wellington', online: true, phone: '+64 22 555 0103', fleetId: 2 },
  { id: 4, name: 'Ben Clarke', code: 'BC-004', location: 'Wellington', online: true, phone: '+64 22 555 0104', fleetId: 2 },
  { id: 5, name: 'Marcus Johnson', code: 'MJ-005', location: 'Dallas', online: false, phone: '+1 214 555 0105', fleetId: 3 },
  { id: 6, name: 'Priya Sharma', code: 'PS-006', location: 'Christchurch', online: true, phone: '+64 27 555 0106', fleetId: 4 },
  { id: 7, name: 'Ethan Brown', code: 'EB-007', location: 'Houston', online: false, phone: '+1 832 555 0107', fleetId: 5 },
  { id: 8, name: 'Lily Chen', code: 'LC-008', location: 'Auckland', online: true, phone: '+64 21 555 0108', fleetId: 1 },
];

const MOCK_MESSAGES: ChatMessage[] = [
  { id: 1, courierId: 1, text: 'Hey James, can you cover the CBD run today?', sent: true, type: 1, timestamp: '2026-03-07T14:30:00Z', read: true },
  { id: 2, courierId: 1, text: 'Yeah no worries, heading there now', sent: false, type: 1, timestamp: '2026-03-07T14:32:00Z', read: true },
  { id: 3, courierId: 1, text: 'Sweet, there are 4 pickups waiting at the depot', sent: true, type: 1, timestamp: '2026-03-07T14:33:00Z', read: true },
  { id: 4, courierId: 3, text: 'Aroha, your compliance docs expire next week', sent: true, type: 2, timestamp: '2026-03-07T10:00:00Z', read: true },
  { id: 5, courierId: 3, text: 'Thanks for the heads up, uploading now', sent: false, type: 2, timestamp: '2026-03-07T10:15:00Z', read: true },
  { id: 6, courierId: 5, text: 'Marcus, route change for tomorrow - check app', sent: true, type: 1, timestamp: '2026-03-06T16:00:00Z', read: true },
  { id: 7, courierId: 5, text: 'Got it, thanks', sent: false, type: 1, timestamp: '2026-03-06T16:30:00Z', read: false },
  { id: 8, courierId: 6, text: 'Priya, can you do a Saturday shift?', sent: true, type: 2, timestamp: '2026-03-07T09:00:00Z', read: true },
  { id: 9, courierId: 6, text: 'Sure, what time?', sent: false, type: 2, timestamp: '2026-03-07T09:05:00Z', read: false },
  { id: 10, courierId: 8, text: 'Lily, new pickup from Queen St store', sent: true, type: 1, timestamp: '2026-03-07T15:00:00Z', read: true },
  { id: 11, courierId: 8, text: 'On my way!', sent: false, type: 1, timestamp: '2026-03-07T15:02:00Z', read: false },
  { id: 12, courierId: 4, text: 'Ben, fuel card has been topped up', sent: true, type: 3, timestamp: '2026-03-07T11:00:00Z', read: true },
];

const MOCK_BULK_SENT: BulkSent[] = [
  {
    id: 1, text: 'Reminder: All vehicles must be inspected by Friday 5pm.', date: '2026-03-06', type: 1,
    recipients: [
      { courierId: 1, name: 'James Tua', status: 'delivered' },
      { courierId: 2, name: 'Sarah Mitchell', status: 'delivered' },
      { courierId: 3, name: 'Aroha Nikora', status: 'delivered' },
      { courierId: 8, name: 'Lily Chen', status: 'pending' },
    ],
  },
  {
    id: 2, text: 'Public holiday Monday - reduced routes. Check schedule.', date: '2026-03-05', type: 2,
    recipients: [
      { courierId: 1, name: 'James Tua', status: 'delivered' },
      { courierId: 3, name: 'Aroha Nikora', status: 'delivered' },
      { courierId: 4, name: 'Ben Clarke', status: 'pending' },
      { courierId: 5, name: 'Marcus Johnson', status: 'delivered' },
      { courierId: 6, name: 'Priya Sharma', status: 'delivered' },
    ],
  },
  {
    id: 3, text: 'New app update available - please update before tomorrow.', date: '2026-03-04', type: 3,
    recipients: [
      { courierId: 1, name: 'James Tua', status: 'delivered' },
      { courierId: 2, name: 'Sarah Mitchell', status: 'delivered' },
      { courierId: 7, name: 'Ethan Brown', status: 'pending' },
    ],
  },
];

const MOCK_REPLIES: IncomingReply[] = [
  { id: 1, courierId: 7, courierName: 'Ethan Brown', text: 'Can I swap my Tuesday shift?', timestamp: '2026-03-07T13:00:00Z' },
  { id: 2, courierId: 2, courierName: 'Sarah Mitchell', text: 'Van needs a service - oil light on', timestamp: '2026-03-07T11:30:00Z' },
  { id: 3, courierId: 4, courierName: 'Ben Clarke', text: 'Confirmed for Saturday morning', timestamp: '2026-03-07T10:45:00Z' },
  { id: 4, courierId: 5, courierName: 'Marcus Johnson', text: 'Running 15 min late, traffic on I-35', timestamp: '2026-03-07T08:20:00Z' },
];

const LOCATIONS = ['Auckland', 'Wellington', 'Christchurch', 'Dallas', 'Houston'];

type MsgType = 1 | 2 | 3;
type TabKey = 'quick' | 'recent' | 'sent' | 'replies';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function typeIcon(t: MsgType) {
  return t === 1 ? '📱' : t === 2 ? '💬' : '📱💬';
}

// ─── Component ───────────────────────────────────────────────

interface CourierMessengerProps {
  open: boolean;
  onClose: () => void;
}

export function CourierMessenger({ open, onClose }: CourierMessengerProps) {
  const [tab, setTab] = useState<TabKey>('quick');
  const [msgType, setMsgType] = useState<MsgType>(1);
  const [message, setMessage] = useState('');
  const [selectedCouriers, setSelectedCouriers] = useState<MockCourier[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [chatCourierId, setChatCourierId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [expandedBulk, setExpandedBulk] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFleets(fleetService.getAll());
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatCourierId]);

  const maxChars = msgType === 2 ? 160 : 500;
  const remaining = maxChars - message.length;

  const addFleetCouriers = (fleetId: number) => {
    const toAdd = MOCK_COURIERS.filter(c => c.fleetId === fleetId && !selectedCouriers.find(s => s.id === c.id));
    setSelectedCouriers(prev => [...prev, ...toAdd]);
  };

  const addLocationCouriers = (loc: string) => {
    const toAdd = MOCK_COURIERS.filter(c => c.location === loc && !selectedCouriers.find(s => s.id === c.id));
    setSelectedCouriers(prev => [...prev, ...toAdd]);
  };

  const removeCourier = (id: number) => {
    setSelectedCouriers(prev => prev.filter(c => c.id !== id));
  };

  // Recent conversations: couriers with messages, last message first
  const recentCouriers = (() => {
    const courierIds = [...new Set(MOCK_MESSAGES.map(m => m.courierId))];
    return courierIds.map(cid => {
      const courier = MOCK_COURIERS.find(c => c.id === cid)!;
      const msgs = MOCK_MESSAGES.filter(m => m.courierId === cid);
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter(m => !m.sent && !m.read).length;
      return { courier, lastMessage: last, unread };
    }).sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime());
  })();

  const unreadCount = MOCK_MESSAGES.filter(m => !m.sent && !m.read).length;

  // Courier search
  const [courierSearch, setCourierSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const courierSearchResults = courierSearch.trim().length > 0
    ? MOCK_COURIERS.filter(c =>
        c.name.toLowerCase().includes(courierSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(courierSearch.toLowerCase())
      )
    : [];

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'quick', label: 'Quick Message' },
    { key: 'recent', label: 'Recent Messages' },
    { key: 'sent', label: 'Sent' },
    { key: 'replies', label: 'Replies' },
  ];

  const chatMessages = chatCourierId ? MOCK_MESSAGES.filter(m => m.courierId === chatCourierId) : [];
  const chatCourier = chatCourierId ? MOCK_COURIERS.find(c => c.id === chatCourierId) : null;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-[998] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-[999] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 420 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-brand-dark text-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <span className="text-base font-semibold">Messenger</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl bg-transparent border-none cursor-pointer p-1">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setChatCourierId(null); }}
              className={`flex-1 py-2.5 text-xs font-medium bg-transparent border-none cursor-pointer transition-colors ${
                tab === t.key
                  ? 'text-brand-cyan border-b-2 border-brand-cyan'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              style={tab === t.key ? { borderBottom: '2px solid #3bc7f4' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Courier Search */}
        <div className="px-4 pt-3 pb-2 border-b border-border bg-white" ref={searchRef}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
            <input
              type="text"
              value={courierSearch}
              onChange={e => { setCourierSearch(e.target.value); setShowSearchResults(true); }}
              onFocus={() => { if (courierSearch.trim()) setShowSearchResults(true); }}
              placeholder="Search courier by name or number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
            />
            {courierSearch && (
              <button
                onClick={() => { setCourierSearch(''); setShowSearchResults(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-dark bg-transparent border-none cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>
          {showSearchResults && courierSearch.trim().length > 0 && (
            <div className="absolute left-4 right-4 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {courierSearchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-text-muted text-center">No couriers found</div>
              ) : (
                courierSearchResults.map(c => {
                  const lastMsg = MOCK_MESSAGES.filter(m => m.courierId === c.id).pop();
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setChatCourierId(c.id);
                        setTab('recent');
                        setCourierSearch('');
                        setShowSearchResults(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light border-none bg-transparent cursor-pointer text-left transition-colors"
                      style={{ borderBottom: '1px solid #f0f0f0' }}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-[10px] font-semibold">
                          {getInitials(c.name)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${c.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-brand-dark">{c.name}</div>
                        <div className="text-[10px] text-text-muted">{c.code} · {c.location}</div>
                      </div>
                      {lastMsg && (
                        <span className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(lastMsg.timestamp)}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── Quick Message ─── */}
          {tab === 'quick' && (
            <div className="p-4 flex flex-col gap-4">
              {/* Message Type */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Message Type</label>
                <div className="flex gap-1">
                  {([1, 2, 3] as MsgType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setMsgType(t); if (t === 2 && message.length > 160) setMessage(message.slice(0, 160)); }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md border cursor-pointer transition-colors ${
                        msgType === t
                          ? 'bg-brand-cyan text-white border-brand-cyan'
                          : 'bg-white text-text-muted border-border hover:border-brand-cyan'
                      }`}
                    >
                      {t === 1 ? '📱 App Push' : t === 2 ? '💬 SMS' : '📱💬 Mixed'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, maxChars))}
                  placeholder="Type your message..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
                />
                <div className={`text-right text-[11px] mt-0.5 ${remaining < 20 ? 'text-red-500 font-medium' : 'text-text-muted'}`}>
                  {remaining} characters remaining
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Recipients</label>

                {/* Add Individual Courier */}
                <div className="mb-2">
                  <label className="text-[11px] text-text-muted block mb-1">Add Courier</label>
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        const c = MOCK_COURIERS.find(c => c.id === Number(e.target.value));
                        if (c && !selectedCouriers.find(s => s.id === c.id)) {
                          setSelectedCouriers(prev => [...prev, c]);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                    defaultValue=""
                  >
                    <option value="" disabled>Search by name or number...</option>
                    {MOCK_COURIERS.filter(c => !selectedCouriers.find(s => s.id === c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.location})</option>
                    ))}
                  </select>
                </div>

                {/* By Fleet */}
                <div className="mb-2">
                  <label className="text-[11px] text-text-muted block mb-1">By Fleet</label>
                  <select
                    onChange={e => { if (e.target.value) addFleetCouriers(Number(e.target.value)); e.target.value = ''; }}
                    className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a fleet...</option>
                    {fleets.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* By Location */}
                <div className="mb-2">
                  <label className="text-[11px] text-text-muted block mb-1">By Location</label>
                  <select
                    onChange={e => { if (e.target.value) addLocationCouriers(e.target.value); e.target.value = ''; }}
                    className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a location...</option>
                    {LOCATIONS.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* Selected Pills */}
                {selectedCouriers.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-brand-cyan mb-1.5">
                      {selectedCouriers.length} courier{selectedCouriers.length !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCouriers.map(c => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-brand-cyan/40 bg-brand-cyan/5 text-brand-dark"
                        >
                          {c.name}
                          <button
                            onClick={() => removeCourier(c.id)}
                            className="text-text-muted hover:text-red-500 bg-transparent border-none cursor-pointer p-0 text-xs leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Send */}
              <button
                disabled={!message.trim() || selectedCouriers.length === 0}
                className="w-full py-2.5 rounded-lg font-medium text-sm text-white bg-brand-cyan hover:bg-brand-cyan/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border-none cursor-pointer"
              >
                Send {msgType === 1 ? 'App Push' : msgType === 2 ? 'SMS' : 'Mixed Message'}
              </button>
            </div>
          )}

          {/* ─── Recent ─── */}
          {tab === 'recent' && !chatCourierId && (
            <div>
              {recentCouriers.map(({ courier, lastMessage, unread }) => (
                <button
                  key={courier.id}
                  onClick={() => setChatCourierId(courier.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-light border-none bg-transparent cursor-pointer text-left transition-colors border-b border-border"
                  style={{ borderBottom: '1px solid #e5e5e5' }}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-brand-dark text-white flex items-center justify-center text-xs font-semibold">
                      {getInitials(courier.name)}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        courier.online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-dark truncate">{courier.name}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(lastMessage.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[11px]">{typeIcon(lastMessage.type)}</span>
                      <span className="text-xs text-text-muted truncate">
                        {lastMessage.sent ? 'You: ' : ''}{lastMessage.text}
                      </span>
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                      {unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ─── Chat View ─── */}
          {tab === 'recent' && chatCourierId && chatCourier && (
            <div className="flex flex-col h-full">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-light">
                <button
                  onClick={() => setChatCourierId(null)}
                  className="text-text-muted hover:text-brand-dark bg-transparent border-none cursor-pointer text-lg p-0"
                >
                  ←
                </button>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-xs font-semibold">
                    {getInitials(chatCourier.name)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-light ${chatCourier.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-brand-dark">{chatCourier.name}</div>
                  <div className="text-[10px] text-text-muted">{chatCourier.online ? 'Online' : 'Offline'} · {chatCourier.location}</div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ minHeight: 200 }}>
                {chatMessages.map(m => (
                  <div key={m.id} className={`flex ${m.sent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                        m.sent
                          ? 'bg-brand-cyan text-white rounded-br-sm'
                          : 'bg-surface-light text-brand-dark rounded-bl-sm'
                      }`}
                    >
                      <div>{m.text}</div>
                      <div className={`text-[10px] mt-1 ${m.sent ? 'text-white/70' : 'text-text-muted'} flex items-center gap-1`}>
                        <span>{typeIcon(m.type)}</span>
                        <span>{timeAgo(m.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply input */}
              <div className="border-t border-border p-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
                />
                <button
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-brand-cyan text-white text-sm font-medium rounded-lg border-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-brand-cyan/90 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* ─── Sent ─── */}
          {tab === 'sent' && (
            <div className="p-4 flex flex-col gap-3">
              {MOCK_BULK_SENT.map(b => (
                <div key={b.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedBulk(expandedBulk === b.id ? null : b.id)}
                    className="w-full flex items-start gap-3 p-3 bg-white hover:bg-surface-light border-none cursor-pointer text-left transition-colors"
                  >
                    <span className="text-sm">{typeIcon(b.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-brand-dark">{b.text}</div>
                      <div className="text-[11px] text-text-muted mt-1">
                        {b.date} · {b.recipients.length} recipients
                      </div>
                    </div>
                    <span className="text-text-muted text-xs">{expandedBulk === b.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedBulk === b.id && (
                    <div className="border-t border-border bg-surface-light px-3 py-2">
                      {b.recipients.map(r => (
                        <div key={r.courierId} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="text-brand-dark">{r.name}</span>
                          <span className={r.status === 'delivered' ? 'text-green-600' : 'text-amber-500'}>
                            {r.status === 'delivered' ? '✓ Delivered' : '⏳ Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Replies ─── */}
          {tab === 'replies' && (
            <div className="p-4 flex flex-col gap-2">
              {MOCK_REPLIES.map(r => {
                const courier = MOCK_COURIERS.find(c => c.id === r.courierId);
                return (
                  <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-white hover:bg-surface-light transition-colors">
                    <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {getInitials(r.courierName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-brand-dark">{r.courierName}</span>
                        <span className="text-[10px] text-text-muted">{timeAgo(r.timestamp)}</span>
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">{r.text}</div>
                      {courier && (
                        <div className="text-[10px] text-text-muted mt-1">{courier.location} · {courier.code}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Hook for unread count ───

export function useMessengerUnread() {
  return MOCK_MESSAGES.filter(m => !m.sent && !m.read).length;
}
