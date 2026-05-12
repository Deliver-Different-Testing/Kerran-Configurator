import { useState, useMemo, useCallback } from 'react';
import {
  MOCK_LOCATION_SUMMARIES,
  MOCK_COURIER_RESPONSES_BY_SCHEDULE,
  MOCK_PENDING_NOTIFICATIONS,
  LOCATIONS,
  VEHICLE_TYPES,
  type LocationSummary,
  type ScheduleSummary,
  type TimeSlotVehicle,
  type CourierBySchedule,
  type ScheduleDto,
} from '@/services/np_schedulingMockData';

// ─── Helpers ───
const fmtTime = (ts: string) => {
  const [h, m] = ts.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${d.getMinutes().toString().padStart(2, '0')} ${ampm}`;
};

const fmtDateFull = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDateShort = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString('en-NZ', { month: 'short' })} ${d.getHours() % 12 || 12}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
};

const dateToInput = (d: Date) => d.toISOString().split('T')[0];

export default function Scheduling() {
  // ─── State ───
  const [selectedDate, setSelectedDate] = useState(dateToInput(new Date()));
  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [courierTab, setCourierTab] = useState<0 | 1 | 2>(0); // 0=Pending, 1=Available, 2=Unavailable
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyStep, setNotifyStep] = useState<1 | 2>(1);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copiedSchedules, setCopiedSchedules] = useState<{ sourceDate: string; locations: string[]; scheduleId?: number; scheduleName?: string } | null>(null);
  const [copyMode, setCopyMode] = useState<'location' | 'schedule'>('location');
  const [copySingleSchedule, setCopySingleSchedule] = useState<{ id: number; name: string; location: string } | null>(null);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [showTimeSlotAssignModal, setShowTimeSlotAssignModal] = useState(false);
  const [assignCourierId, setAssignCourierId] = useState<number | null>(null);
  const [pendingNotifications, setPendingNotifications] = useState<ScheduleDto[]>([...MOCK_PENDING_NOTIFICATIONS]);
  const [responseFilter, setResponseFilter] = useState<'all' | 'pending' | 'available' | 'unavailable'>('all');

  // Create form
  const [createLocation, setCreateLocation] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStart, setCreateStart] = useState('08:00');
  const [createEnd, setCreateEnd] = useState('19:00');
  const [createWanted, setCreateWanted] = useState(50);

  // Time slot form
  const [tsLocation, setTsLocation] = useState('');
  const [tsTime, setTsTime] = useState('08:00');
  const [tsWanted, setTsWanted] = useState(5);
  const [tsVehicleTypes, setTsVehicleTypes] = useState<string[]>([]);

  // Copy form
  const [copyLocations, setCopyLocations] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<Set<number>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Data ───
  const locationSummaries: LocationSummary[] = MOCK_LOCATION_SUMMARIES;
  const currentLocation = locationSummaries[selectedLocationIdx] || null;
  const selectedSchedule = currentLocation?.scheduleSummaries.find(s => s.id === selectedScheduleId) || null;

  // Time slots for selected schedule
  const scheduleTimeSlots = useMemo(() => {
    if (!selectedSchedule || !currentLocation) return [];
    return currentLocation.timeSlots.filter(t => {
      const tTime = new Date(t.bookDateTime);
      const [sh, sm] = selectedSchedule.startTime.split(':').map(Number);
      const [eh, em] = selectedSchedule.endTime.split(':').map(Number);
      const start = new Date(tTime); start.setHours(sh, sm, 0, 0);
      const end = new Date(tTime); end.setHours(eh, em, 0, 0);
      return tTime >= start && tTime < end;
    });
  }, [selectedSchedule, currentLocation]);

  // Courier responses
  const allResponses: CourierBySchedule[] = selectedScheduleId ? (MOCK_COURIER_RESPONSES_BY_SCHEDULE[selectedScheduleId] || []) : [];
  const pendingCouriers = allResponses.filter(r => !r.scheduleResponse);
  const availableCouriers = allResponses.filter(r => r.scheduleResponse && r.scheduleResponse.statusId === 1);
  const unavailableCouriers = allResponses.filter(r => r.scheduleResponse && r.scheduleResponse.statusId === 2);

  const courierList = courierTab === 0 ? pendingCouriers : courierTab === 1 ? availableCouriers : unavailableCouriers;

  const handleSelectSchedule = useCallback((id: number) => {
    setSelectedScheduleId(prev => prev === id ? null : id);
    setCourierTab(1); // Default to Available tab
  }, []);

  const wantedColor = (wanted: number, available: number) => {
    if (available < wanted) return 'text-red-500';
    if (available === wanted) return 'text-orange-500';
    return 'text-green-500';
  };

  const wantedBg = (wanted: number, available: number) => {
    if (available < wanted) return 'bg-red-500/10 border-red-500/30';
    if (available === wanted) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-green-500/10 border-green-500/30';
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* ─── Main Content ─── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Scheduling</h1>
            <p className="text-sm text-text-secondary mt-1">{fmtDateFull(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy */}
            {locationSummaries.length > 0 && (
              <button
                onClick={() => { setCopyLocations(locationSummaries.map(l => l.location)); setCopyMode('location'); setCopySingleSchedule(null); setShowCopyModal(true); }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-surface-light transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copy
              </button>
            )}
            {/* Paste */}
            {copiedSchedules && copiedSchedules.sourceDate !== selectedDate && (
              <button
                onClick={() => {
                  if (copiedSchedules.scheduleId) {
                    showToast(`Schedule "${copiedSchedules.scheduleName}" pasted to ${selectedDate}`);
                  } else {
                    showToast(`Schedules pasted to ${selectedDate} for: ${copiedSchedules.locations.join(', ')}`);
                  }
                  setCopiedSchedules(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                Paste
              </button>
            )}
            {/* Notify */}
            <button
              onClick={() => { setShowNotifyModal(true); setNotifyStep(1); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#0d0c2c] text-white hover:bg-[#1a1940] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
              Notify ({pendingNotifications.length})
            </button>
          </div>
        </div>

        {/* Location Tabs */}
        {locationSummaries.length > 0 ? (
          <>
            <div className="flex gap-1 mb-4 border-b border-border">
              {locationSummaries.map((loc, idx) => (
                <button
                  key={loc.location}
                  onClick={() => { setSelectedLocationIdx(idx); setSelectedScheduleId(null); }}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    idx === selectedLocationIdx
                      ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/5'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-light'
                  }`}
                >
                  {loc.location}
                </button>
              ))}
            </div>

            {/* Location Summary Bar */}
            {currentLocation && (
              <div className="flex items-center gap-6 px-4 py-3 mb-4 bg-surface-light rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Couriers:</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {currentLocation.totalAvailable} / {currentLocation.totalCouriers}
                  </span>
                </div>
              </div>
            )}

            {/* Schedule Cards */}
            {currentLocation && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {currentLocation.scheduleSummaries.map(schedule => (
                  <div
                    key={schedule.id}
                    onClick={() => handleSelectSchedule(schedule.id)}
                    className={`rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedScheduleId === schedule.id
                        ? 'border-brand-cyan bg-brand-cyan/5 shadow-md ring-1 ring-brand-cyan/30'
                        : 'border-border bg-white hover:border-brand-cyan/40'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between p-4 pb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{schedule.name}</h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {fmtTime(schedule.startTime)} – {fmtTime(schedule.endTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Copy single schedule */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCopySingleSchedule({ id: schedule.id, name: schedule.name, location: currentLocation!.location });
                            setCopyMode('schedule');
                            setShowCopyModal(true);
                          }}
                          className="p-1.5 rounded hover:bg-brand-cyan/10 text-text-muted hover:text-brand-cyan transition-colors"
                          title="Copy this schedule"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                        {!schedule.notificationSent && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: schedule.id, name: schedule.name }); }}
                            className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                            title="Delete schedule"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        )}
                        {schedule.notificationSent && new Date(`${schedule.bookDate}T${schedule.startTime}`) > new Date() && (
                          <button
                            onClick={(e) => { e.stopPropagation(); showToast(`Reminders sent for: ${schedule.name}`); }}
                            className="p-1.5 rounded hover:bg-brand-cyan/10 text-text-muted hover:text-brand-cyan transition-colors"
                            title="Send reminders"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Breakdown */}
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {schedule.vehicleSummaries.map(v => (
                          <span key={v.vehicle} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-surface-light border border-border text-text-secondary">
                            {v.vehicle}: <span className="font-medium text-text-primary">{v.available}/{v.total}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-surface-light/50 rounded-b-lg">
                      <span className="text-[11px] text-text-muted">
                        {schedule.notificationSent ? `Sent ${fmtDateShort(schedule.notificationSent)}` : 'Not notified'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary">
                          Wanted: <span className="font-semibold">{schedule.wanted}</span>
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${wantedBg(schedule.wanted, schedule.available)} ${wantedColor(schedule.wanted, schedule.available)}`}>
                          {schedule.available}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Time Slots Section */}
            {currentLocation && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Time Slots {selectedSchedule ? `— ${selectedSchedule.name}` : `— ${currentLocation.location}`}
                  </h2>
                  <button
                    onClick={() => { setTsLocation(currentLocation.location); setShowTimeSlotModal(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Add Slot
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(selectedSchedule ? scheduleTimeSlots : currentLocation.timeSlots).map(slot => (
                    <div key={slot.id} className="flex flex-col gap-1 px-3 py-2.5 rounded-lg border border-border bg-white min-w-[140px]">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span className="text-sm font-medium text-text-primary">{fmtDateTime(slot.bookDateTime)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {slot.vehicleTypes.length > 0 ? slot.vehicleTypes.map(v => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-medium">{v}</span>
                        )) : (
                          <span className="text-[10px] text-text-muted">All vehicles</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-text-secondary">Wanted: {slot.wanted || 'N/A'}</span>
                        <div className="flex items-center gap-1">
                          <button className="p-0.5 rounded hover:bg-surface-light text-text-muted hover:text-text-primary" title="Edit">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button className="p-0.5 rounded hover:bg-red-50 text-text-muted hover:text-red-500" title="Delete">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(selectedSchedule ? scheduleTimeSlots : currentLocation.timeSlots).length === 0 && (
                    <p className="text-sm text-text-muted py-2">No time slots.</p>
                  )}
                </div>
              </div>
            )}

            {/* Courier Responses */}
            {selectedSchedule && selectedSchedule.notificationSent && (
              <div className="border border-border rounded-lg bg-white">
                {/* Response Filter Tabs */}
                <div className="flex items-center border-b border-border">
                  <div className="flex">
                    {([
                      { key: 0 as const, label: 'Pending', count: pendingCouriers.length },
                      { key: 1 as const, label: 'Available', count: availableCouriers.length },
                      { key: 2 as const, label: 'Unavailable', count: unavailableCouriers.length },
                    ]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setCourierTab(tab.key)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          courierTab === tab.key
                            ? 'border-brand-cyan text-brand-cyan'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>
                  {/* Global Response Filter */}
                  <div className="ml-auto pr-4">
                    <select
                      value={responseFilter}
                      onChange={e => setResponseFilter(e.target.value as typeof responseFilter)}
                      className="text-xs border border-border rounded px-2 py-1 bg-white text-text-secondary"
                    >
                      <option value="all">All Schedules</option>
                      <option value="pending">Pending (Global)</option>
                      <option value="available">Available (Global)</option>
                      <option value="unavailable">Unavailable (Global)</option>
                    </select>
                  </div>
                </div>

                {/* Courier Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-light border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Code</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Mobile</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Vehicle</th>
                        {scheduleTimeSlots.length > 0 && (
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Time Slot</th>
                        )}
                        {courierTab !== 0 && (
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Updated</th>
                        )}
                        {courierTab === 1 && (
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {courierList.map(cr => (
                        <tr key={cr.courier.id} className="border-b border-border/50 hover:bg-surface-light/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-brand-cyan">{cr.courier.code}</td>
                          <td className="px-4 py-2.5 text-text-primary">{cr.courier.firstName} {cr.courier.surname}</td>
                          <td className="px-4 py-2.5 text-text-secondary">{cr.courier.mobile}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-light border border-border text-text-secondary">
                              {cr.courier.vehicleType}
                            </span>
                          </td>
                          {scheduleTimeSlots.length > 0 && (
                            <td className="px-4 py-2.5 text-text-secondary text-xs">
                              {cr.scheduleResponse?.timeSlot ? fmtDateTime(cr.scheduleResponse.timeSlot.bookDateTime) : (
                                <span className="text-text-muted italic">{cr.scheduleResponse?.statusId === 1 ? 'RESERVE' : '—'}</span>
                              )}
                            </td>
                          )}
                          {courierTab !== 0 && (
                            <td className="px-4 py-2.5 text-text-muted text-xs">
                              {cr.scheduleResponse ? new Date(cr.scheduleResponse.updated).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}
                            </td>
                          )}
                          {courierTab === 1 && (
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                {scheduleTimeSlots.length > 0 && (
                                  <button
                                    onClick={() => { setAssignCourierId(cr.courier.id); setShowTimeSlotAssignModal(true); }}
                                    className="p-1 rounded hover:bg-brand-cyan/10 text-text-muted hover:text-brand-cyan transition-colors"
                                    title="Assign time slot"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                  </button>
                                )}
                                <button className="p-1 rounded hover:bg-green-50 text-text-muted hover:text-green-600 transition-colors" title="Mark available">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                </button>
                                <button className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors" title="Cancel">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {courierList.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-sm text-text-muted">
                            No couriers in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedSchedule && !selectedSchedule.notificationSent && (
              <div className="border border-border rounded-lg bg-white p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-text-muted mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>
                <p className="text-sm text-text-secondary mb-1">Schedule not yet notified</p>
                <p className="text-xs text-text-muted">Send notifications to see courier responses</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64 border border-border rounded-lg bg-white">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-text-muted mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              <p className="text-sm text-text-secondary">No schedules for this date</p>
              <p className="text-xs text-text-muted mt-1">Create a schedule using the form on the right</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Panel ─── */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Date Picker */}
        <div className="bg-white rounded-lg border border-border p-4">
          <label className="block text-xs font-medium text-text-secondary mb-2">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setSelectedScheduleId(null); setSelectedLocationIdx(0); }}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 focus:border-brand-cyan"
          />
        </div>

        {/* New Schedule Form */}
        <div className="bg-white rounded-lg border border-border">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-light transition-colors rounded-t-lg"
          >
            <span>New Schedule</span>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${showCreateForm ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {showCreateForm && (
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                <select
                  value={createLocation}
                  onChange={e => setCreateLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                >
                  <option value="">Select...</option>
                  {LOCATIONS.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Morning Bulk"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Start Time</label>
                  <input
                    type="time"
                    value={createStart}
                    onChange={e => setCreateStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">End Time</label>
                  <input
                    type="time"
                    value={createEnd}
                    onChange={e => setCreateEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Wanted</label>
                <input
                  type="number"
                  value={createWanted}
                  onChange={e => setCreateWanted(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/30"
                />
              </div>
              <button
                onClick={() => { showToast(`Schedule "${createName}" created at ${createLocation}`); setShowCreateForm(false); setCreateName(''); setCreateLocation(''); }}
                disabled={!createLocation || !createName || !createStart || !createEnd || createWanted < 1}
                className="w-full py-2 text-sm font-medium rounded-lg bg-brand-cyan text-white hover:bg-brand-cyan/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Schedule
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Quick Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Locations</span>
              <span className="font-medium text-text-primary">{locationSummaries.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total Schedules</span>
              <span className="font-medium text-text-primary">{locationSummaries.reduce((a, l) => a + l.scheduleSummaries.length, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Pending Notify</span>
              <span className="font-medium text-orange-500">{pendingNotifications.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Time Slots</span>
              <span className="font-medium text-text-primary">{locationSummaries.reduce((a, l) => a + l.timeSlots.length, 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Notify Modal ─── */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowNotifyModal(false); }}>
          <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Pending Notifications</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {notifyStep === 1 ? 'Review schedules to notify couriers about' : 'Confirm sending notifications'}
              </p>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Date</th>
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Location</th>
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Name</th>
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Wanted</th>
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Time</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingNotifications.map(s => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 text-text-primary">{fmtDateFull(s.bookDate)}</td>
                      <td className="py-2 text-text-secondary">{s.location}</td>
                      <td className="py-2 text-text-primary font-medium">{s.name}</td>
                      <td className="py-2 text-text-secondary">{s.wanted}</td>
                      <td className="py-2 text-text-secondary text-xs">{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</td>
                      <td className="py-2">
                        {notifyStep === 1 && (
                          <button
                            onClick={() => setPendingNotifications(prev => prev.filter(n => n.id !== s.id))}
                            className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-500"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pendingNotifications.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-text-muted">No pending notifications</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              {notifyStep === 1 ? (
                <>
                  <button onClick={() => setShowNotifyModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Cancel</button>
                  {pendingNotifications.length > 0 && (
                    <button onClick={() => setNotifyStep(2)} className="px-4 py-2 text-sm rounded-lg bg-[#0d0c2c] text-white hover:bg-[#1a1940]">
                      Send
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => setNotifyStep(1)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Back</button>
                  <button
                    onClick={() => { showToast(`Notifications sent for ${pendingNotifications.length} schedule(s)`); setPendingNotifications([]); setShowNotifyModal(false); }}
                    className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Confirm Send
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Copy Modal ─── */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowCopyModal(false); }}>
          <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">
                {copyMode === 'schedule' ? 'Copy Schedule' : 'Copy Schedules'}
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {copyMode === 'schedule' && copySingleSchedule
                  ? `Copy "${copySingleSchedule.name}" from ${fmtDateFull(selectedDate)} to another date`
                  : `From ${fmtDateFull(selectedDate)}`}
              </p>
            </div>
            <div className="px-6 py-4">
              {copyMode === 'schedule' && copySingleSchedule ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-brand-cyan/5 border border-brand-cyan/20 rounded-lg">
                    <svg className="w-5 h-5 text-brand-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{copySingleSchedule.name}</p>
                      <p className="text-xs text-text-secondary">{copySingleSchedule.location}</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">Navigate to the target date and use the Paste button to apply this schedule.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-secondary mb-3">Select locations to copy:</p>
                  <div className="space-y-2">
                    {locationSummaries.map(l => (
                      <div key={l.location} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-text-primary">{l.location}</span>
                        <button
                          onClick={() => setCopyLocations(prev => prev.includes(l.location) ? prev.filter(x => x !== l.location) : [...prev, l.location])}
                          className={`p-1 rounded ${copyLocations.includes(l.location) ? 'text-brand-cyan' : 'text-text-muted'}`}
                        >
                          {copyLocations.includes(l.location) ? (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowCopyModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Cancel</button>
              <button
                onClick={() => {
                  if (copyMode === 'schedule' && copySingleSchedule) {
                    setCopiedSchedules({ sourceDate: selectedDate, locations: [copySingleSchedule.location], scheduleId: copySingleSchedule.id, scheduleName: copySingleSchedule.name });
                  } else {
                    setCopiedSchedules({ sourceDate: selectedDate, locations: copyLocations });
                  }
                  setShowCopyModal(false);
                }}
                disabled={copyMode === 'location' && copyLocations.length === 0}
                className="px-4 py-2 text-sm rounded-lg bg-[#0d0c2c] text-white hover:bg-[#1a1940] disabled:opacity-40"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Time Slot Modal ─── */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowTimeSlotModal(false); }}>
          <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">New Time Slot</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                <select value={tsLocation} onChange={e => setTsLocation(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg">
                  {LOCATIONS.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Time</label>
                <input type="time" value={tsTime} onChange={e => setTsTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Wanted</label>
                <input type="number" value={tsWanted} onChange={e => setTsWanted(Number(e.target.value))} min={1} className="w-full px-3 py-2 text-sm border border-border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Vehicle Types</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tsVehicleTypes.map(v => (
                    <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-brand-cyan/10 text-brand-cyan">
                      {v}
                      <button onClick={() => setTsVehicleTypes(prev => prev.filter(x => x !== v))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <select
                  value=""
                  onChange={e => { if (e.target.value && !tsVehicleTypes.includes(e.target.value)) setTsVehicleTypes(prev => [...prev, e.target.value]); }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                >
                  <option value="">Add vehicle type...</option>
                  {VEHICLE_TYPES.filter(v => !tsVehicleTypes.includes(v)).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowTimeSlotModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Cancel</button>
              <button onClick={() => { showToast(`Time slot created: ${tsTime} at ${tsLocation}`); setShowTimeSlotModal(false); }} className="px-4 py-2 text-sm rounded-lg bg-brand-cyan text-white hover:bg-brand-cyan/90">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Assign Time Slot Modal ─── */}
      {showTimeSlotAssignModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setShowTimeSlotAssignModal(false); }}>
          <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Assign Time Slot</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                {scheduleTimeSlots.map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => { showToast(`Time slot ${fmtDateTime(slot.bookDateTime)} assigned`); setShowTimeSlotAssignModal(false); }}
                    className="flex flex-col gap-1 p-3 rounded-lg border border-border hover:border-brand-cyan hover:bg-brand-cyan/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-brand-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span className="text-sm font-medium">{fmtDateTime(slot.bookDateTime)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {slot.vehicleTypes.length > 0 ? slot.vehicleTypes.map(v => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan">{v}</span>
                      )) : <span className="text-[10px] text-text-muted">All vehicles</span>}
                    </div>
                    <span className="text-[11px] text-text-muted">Wanted: {slot.wanted || 'N/A'}</span>
                  </button>
                ))}
                {/* RESERVE option */}
                <button
                  onClick={() => { showToast('Set to RESERVE — no time slot assigned'); setShowTimeSlotAssignModal(false); }}
                  className="flex flex-col gap-1 p-3 rounded-lg border border-dashed border-border hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span className="text-sm font-medium text-orange-600">RESERVE</span>
                  </div>
                  <span className="text-[11px] text-text-muted">No specific time slot</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setShowTimeSlotAssignModal(false)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Delete Modal ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-text-primary mb-2">Delete Schedule</h3>
            <p className="text-sm text-text-secondary mb-5">Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-light">Cancel</button>
              <button
                onClick={() => {
                  setDeletedScheduleIds(prev => new Set([...prev, confirmDelete.id]));
                  showToast(`Schedule "${confirmDelete.name}" deleted`);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0d0c2c] text-white px-4 py-3 rounded-lg shadow-lg text-sm z-[400] animate-in fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
