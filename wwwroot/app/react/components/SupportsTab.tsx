import React, { useEffect, useState, useCallback } from 'react';
import { eventTypeApi } from '../services/api';
import type { EventTypeDto } from '../types';

type FilterMode = 'All' | 'Support' | 'Workflow';

interface EventTypeWithGroups extends EventTypeDto {
  groups: { id: number; mappingId: number; name: string; isActive: boolean }[];
}

export const SupportsTab: React.FC = () => {
  const [eventTypes, setEventTypes] = useState<EventTypeWithGroups[]>([]);
  const [filter, setFilter] = useState<FilterMode>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<'Support' | 'Workflow'>('Support');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await eventTypeApi.getAll();
      const allTypes: EventTypeDto[] = res.eventTypes || [];

      // Load group mappings for each event type
      const withGroups: EventTypeWithGroups[] = await Promise.all(
        allTypes.map(async (et) => {
          try {
            const groupRes = await eventTypeApi.getEventTypeGroups(et.id);
            const mappings = groupRes.mappings || [];
            return {
              ...et,
              groups: mappings
                .filter((m: any) =>
                  m.groupName === 'App Support' || m.groupName === 'App Workflow'
                )
                .map((m: any) => ({
                  id: m.eventTypeGroupId,
                  mappingId: m.id,
                  name: m.groupName,
                  isActive: m.isActive,
                })),
            };
          } catch {
            return { ...et, groups: [] };
          }
        })
      );

      // Only show event types that belong to App Support or App Workflow groups
      const filtered = withGroups.filter((et) => et.groups.length > 0);
      setEventTypes(filtered);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTypes = eventTypes.filter((et) => {
    if (filter === 'All') return true;
    if (filter === 'Support') return et.groups.some((g) => g.name === 'App Support');
    if (filter === 'Workflow') return et.groups.some((g) => g.name === 'App Workflow');
    return true;
  });

  const handleRemoveFromGroup = async (eventTypeId: number, mappingId: number) => {
    try {
      await eventTypeApi.deleteEventTypeGroup(eventTypeId, mappingId);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim()) return;
    try {
      setError('Adding new event types requires the full EventType create flow. Use the Event Types page to create, then assign to App Support/Workflow group here.');
      setShowAddForm(false);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className="text-center p-4">Loading support & workflow types...</div>;

  return (
    <div className="supports-tab">
      {error && <div className="alert alert-warning alert-dismissible">
        {error}
        <button className="btn-close" onClick={() => setError(null)} />
      </div>}

      {/* Filter tabs */}
      <div className="btn-group mb-3">
        {(['All', 'Support', 'Workflow'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            className={`btn btn-sm ${filter === mode ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFilter(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <button
        className="btn btn-sm btn-success ms-3 mb-3"
        onClick={() => setShowAddForm(!showAddForm)}
      >
        + Add Event Type to Group
      </button>

      {showAddForm && (
        <div className="card mb-3 p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label">Event Type Name</label>
              <input
                className="form-control form-control-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Photo Capture"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Group</label>
              <select
                className="form-select form-select-sm"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as any)}
              >
                <option value="Support">App Support</option>
                <option value="Workflow">App Workflow</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-sm btn-primary" onClick={handleAddNew}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event type list */}
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Groups</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTypes.map((et) => (
              <tr key={et.id}>
                <td>{et.id}</td>
                <td>{et.name}</td>
                <td>
                  {et.groups.map((g) => (
                    <span
                      key={g.mappingId}
                      className={`badge me-1 ${
                        g.name === 'App Support' ? 'bg-success' : 'bg-primary'
                      }`}
                    >
                      {g.name === 'App Support' ? 'Support' : 'Workflow'}
                    </span>
                  ))}
                </td>
                <td>
                  {et.groups.map((g) => (
                    <button
                      key={g.mappingId}
                      className="btn btn-sm btn-outline-danger me-1"
                      title={`Remove from ${g.name}`}
                      onClick={() => handleRemoveFromGroup(et.id, g.mappingId)}
                    >
                      X {g.name === 'App Support' ? 'Support' : 'Workflow'}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
            {filteredTypes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">
                  No event types found in this group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupportsTab;
