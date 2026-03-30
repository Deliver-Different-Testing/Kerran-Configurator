import { useState, useRef } from 'react';
import type { AutomationScope, CustomerOption, SpeedOption, SiteOption, RegionOption, JobStatus, JobRelationshipFilter } from '../types';
import { JOB_RELATIONSHIP_OPTIONS } from '../types';

interface ScopeSelectorProps {
  scope: AutomationScope;
  customers: CustomerOption[];
  speeds: SpeedOption[];
  sites: SiteOption[];
  regions: RegionOption[];
  jobStatuses: JobStatus[];
  onChange: (scope: AutomationScope) => void;
  onSearchCustomers?: (query: string) => Promise<CustomerOption[]>;
}

const PRIORITY_OPTIONS = [
  { id: '1', name: 'Critical' },
  { id: '2', name: 'High' },
  { id: '3', name: 'Normal' },
  { id: '4', name: 'Low' },
];

/** Reusable collapsible "Apply to All" toggle + multi-select pill section */
function ScopeFilterSection({
  id,
  label,
  allChecked,
  selectedIds,
  options,
  onAllChange,
  onToggle,
  onClearAll,
  searchable = false,
  onSearch,
}: {
  id: string;
  label: string;
  allChecked: boolean;
  selectedIds: string[];
  options: { id: string; name?: string; shortName?: string }[];
  onAllChange: (checked: boolean) => void;
  onToggle: (optionId: string) => void;
  onClearAll: () => void;
  searchable?: boolean;
  onSearch?: (query: string) => Promise<{ id: string; name?: string; shortName?: string }[]>;
}) {
  const [expanded, setExpanded] = useState(allChecked);
  const [searchQuery, setSearchQuery] = useState('');
  const [serverResults, setServerResults] = useState<{ id: string; name?: string; shortName?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Cache of options selected via server-side search (not in the preloaded options array)
  const [searchSelectedCache, setSearchSelectedCache] = useState<{ id: string; name?: string; shortName?: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Merge preloaded options with search-selected cache for lookups
  const allKnownOptions = [...options, ...searchSelectedCache.filter((c) => !options.find((o) => o.id === c.id))];

  const selectedNames = selectedIds
    .map((sid) => {
      const opt = allKnownOptions.find((o) => o.id === sid);
      return opt ? (opt.name || opt.shortName) : null;
    })
    .filter(Boolean);

  return (
    <div className="auto-scope-group">
      <div className="auto-scope-row">
        <label className="auto-checkbox-label">
          <input
            type="checkbox"
            id={id}
            checked={allChecked}
            onChange={(e) => onAllChange(e.target.checked)}
          />
          Apply to all {label.toLowerCase()}
        </label>

        {!allChecked && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="auto-scope-toggle"
          >
            {expanded ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        )}
      </div>

      {/* Collapsed summary — show selected pills inline */}
      {!allChecked && !expanded && selectedIds.length > 0 && (
        <div className="auto-scope-pills">
          {selectedNames.map((name, i) => (
            <span key={i} className="auto-chip selected auto-chip-sm">
              {name}
              <button
                type="button"
                onClick={() => onToggle(selectedIds[i])}
                className="auto-chip-remove"
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="auto-scope-edit-link"
          >
            + Edit
          </button>
        </div>
      )}

      {/* Collapsed with no selections */}
      {!allChecked && !expanded && selectedIds.length === 0 && (
        <div className="auto-scope-pills">
          <span className="auto-label-xs">
            No {label.toLowerCase()} selected.{' '}
            <button type="button" onClick={() => setExpanded(true)} className="auto-scope-edit-link">
              Select
            </button>
          </span>
        </div>
      )}

      {/* Expanded picker */}
      {!allChecked && expanded && (
        <div className="auto-scope-chips">
          {/* Selected items shown as removable tags */}
          {selectedIds.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="auto-scope-selected-header">
                <span className="auto-label-xs" style={{ fontWeight: 500 }}>
                  Selected ({selectedIds.length}):
                </span>
                <button
                  type="button"
                  onClick={() => onClearAll()}
                  className="auto-scope-clear"
                >
                  Clear all
                </button>
              </div>
              <div className="auto-chip-list">
                {selectedIds.map((selId) => {
                  const opt = allKnownOptions.find((o) => o.id === selId);
                  if (!opt) return null;
                  return (
                    <span key={selId} className="auto-chip selected">
                      {opt.name || opt.shortName}
                      <button
                        type="button"
                        onClick={() => onToggle(selId)}
                        className="auto-chip-remove"
                        title={`Remove ${opt.name || opt.shortName}`}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Searchable mode: search input only, no chips until user types */}
          {searchable ? (
            <div>
              <input
                type="text"
                className="input auto-input-sm"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (onSearch && val.length >= 2) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    setIsSearching(true);
                    debounceRef.current = setTimeout(() => {
                      onSearch(val).then((results) => {
                        setServerResults(results);
                        setIsSearching(false);
                      });
                    }, 250);
                  } else if (onSearch) {
                    setServerResults([]);
                  }
                }}
                placeholder={`Search ${label.toLowerCase()} by name...`}
                style={{ width: '100%', marginBottom: 8 }}
              />
              {searchQuery.length >= 2 ? (
                <div className="auto-chip-list">
                  {(() => {
                    const results = (onSearch ? serverResults : options.filter((opt) => {
                      const q = searchQuery.toLowerCase();
                      return !selectedIds.includes(opt.id) &&
                        (opt.name?.toLowerCase().includes(q) || opt.shortName?.toLowerCase().includes(q));
                    })).filter((opt) => !selectedIds.includes(opt.id));
                    return (
                      <>
                        {isSearching && (
                          <span className="auto-label-xs">Searching...</span>
                        )}
                        {!isSearching && results.slice(0, 20).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              // Cache this option so it can be displayed as a selected chip
                              setSearchSelectedCache((prev) =>
                                prev.find((c) => c.id === opt.id) ? prev : [...prev, opt]
                              );
                              onToggle(opt.id);
                              setSearchQuery('');
                              setServerResults([]);
                            }}
                            className="auto-chip"
                            title={opt.name}
                          >
                            + {opt.name || opt.shortName}
                          </button>
                        ))}
                        {!isSearching && results.length === 0 && (
                          <span className="auto-label-xs" style={{ fontStyle: 'italic' }}>No matches for "{searchQuery}"</span>
                        )}
                        {!isSearching && results.length > 20 && (
                          <span className="auto-label-xs" style={{ fontStyle: 'italic' }}>
                            {results.length - 20} more — keep typing to narrow results
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : searchQuery.length > 0 ? (
                <div className="auto-label-xs">Type at least 2 characters to search</div>
              ) : selectedIds.length === 0 ? (
                <div className="auto-label-xs">
                  Type to search and select specific {label.toLowerCase()}, or check "Apply to all" above.
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Non-searchable: show all chips */}
              <div className="auto-scope-chips-label">
                {selectedIds.length > 0 ? 'Add more:' : `Select ${label.toLowerCase()}:`}
              </div>
              <div className="auto-chip-list">
                {options
                  .filter((opt) => !selectedIds.includes(opt.id))
                  .map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onToggle(opt.id)}
                      className="auto-chip"
                      title={opt.name}
                    >
                      + {opt.name || opt.shortName}
                    </button>
                  ))}
                {options.filter((opt) => !selectedIds.includes(opt.id)).length === 0 && (
                  <span className="auto-label-xs" style={{ fontStyle: 'italic' }}>All {label.toLowerCase()} selected</span>
                )}
              </div>
              {selectedIds.length === 0 && (
                <div className="auto-label-xs" style={{ marginTop: 6 }}>
                  Select specific {label.toLowerCase()} to restrict this automation, or check "Apply to all" above.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ScopeSelector({
  scope,
  customers,
  speeds,
  sites,
  regions,
  jobStatuses,
  onChange,
  onSearchCustomers,
}: ScopeSelectorProps) {
  // Generic helpers
  const makeAllHandler = (allKey: keyof AutomationScope, idsKey: keyof AutomationScope) => (checked: boolean) => {
    onChange({ ...scope, [allKey]: checked, [idsKey]: checked ? [] : (scope as any)[idsKey] });
  };

  const makeToggleHandler = (idsKey: keyof AutomationScope) => (optionId: string) => {
    const current = (scope as any)[idsKey] as string[];
    const newIds = current.includes(optionId)
      ? current.filter((id: string) => id !== optionId)
      : [...current, optionId];
    onChange({ ...scope, [idsKey]: newIds });
  };

  const makeClearHandler = (idsKey: keyof AutomationScope) => () => {
    onChange({ ...scope, [idsKey]: [] });
  };

  // Build summary — only mention filters that have actual selections
  const filterSummaryParts: string[] = [];
  const addSummary = (allFlag: boolean, ids: string[], label: string) => {
    if (!allFlag && ids.length > 0) {
      filterSummaryParts.push(`${ids.length} ${label}`);
    }
  };
  addSummary(scope.allCustomers, scope.customerIds, 'customer(s)');
  addSummary(scope.allSpeeds, scope.speedIds, 'speed(s)');
  addSummary(scope.allJobStatuses, scope.jobStatusIds, 'status(es)');
  addSummary(scope.allPriorities, scope.priorityIds, 'priority(ies)');
  addSummary(scope.allFromSites, scope.fromSiteIds, 'from site(s)');
  addSummary(scope.allToSites, scope.toSiteIds, 'to site(s)');
  addSummary(scope.allFromRegions, scope.fromRegionIds, 'from region(s)');
  addSummary(scope.allToRegions, scope.toRegionIds, 'to region(s)');

  return (
    <div className="auto-scope">
      {/* Customers */}
      <ScopeFilterSection
        id="all-customers"
        label="Customers"
        allChecked={scope.allCustomers}
        selectedIds={scope.customerIds}
        options={customers}
        onAllChange={makeAllHandler('allCustomers', 'customerIds')}
        onToggle={makeToggleHandler('customerIds')}
        onClearAll={makeClearHandler('customerIds')}
        searchable
        onSearch={onSearchCustomers}
      />

      {/* Speeds */}
      <ScopeFilterSection
        id="all-speeds"
        label="Speeds"
        allChecked={scope.allSpeeds}
        selectedIds={scope.speedIds}
        options={speeds}
        onAllChange={makeAllHandler('allSpeeds', 'speedIds')}
        onToggle={makeToggleHandler('speedIds')}
        onClearAll={makeClearHandler('speedIds')}
      />

      {/* Job Relationship (Parent/Child) */}
      <div className="auto-scope-group">
        <label className="auto-label-text" style={{ fontWeight: 500 }}>Job relationship</label>
        <select
          value={scope.jobRelationship || 'all'}
          onChange={(e) => onChange({ ...scope, jobRelationship: e.target.value as JobRelationshipFilter })}
          className="auto-select-sm"
          style={{ width: '100%', marginTop: 4 }}
        >
          {JOB_RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="auto-label-xs" style={{ marginTop: 2 }}>
          {JOB_RELATIONSHIP_OPTIONS.find((o) => o.value === (scope.jobRelationship || 'all'))?.description}
        </div>
      </div>

      {/* Job Statuses */}
      <ScopeFilterSection
        id="all-job-statuses"
        label="Job Statuses"
        allChecked={scope.allJobStatuses}
        selectedIds={scope.jobStatusIds}
        options={jobStatuses}
        onAllChange={makeAllHandler('allJobStatuses', 'jobStatusIds')}
        onToggle={makeToggleHandler('jobStatusIds')}
        onClearAll={makeClearHandler('jobStatusIds')}
      />

      {/* Priorities */}
      <ScopeFilterSection
        id="all-priorities"
        label="Priorities"
        allChecked={scope.allPriorities}
        selectedIds={scope.priorityIds}
        options={PRIORITY_OPTIONS}
        onAllChange={makeAllHandler('allPriorities', 'priorityIds')}
        onToggle={makeToggleHandler('priorityIds')}
        onClearAll={makeClearHandler('priorityIds')}
      />

      {/* Origin Sites */}
      <ScopeFilterSection
        id="all-from-sites"
        label="Origin Sites"
        allChecked={scope.allFromSites}
        selectedIds={scope.fromSiteIds}
        options={sites}
        onAllChange={makeAllHandler('allFromSites', 'fromSiteIds')}
        onToggle={makeToggleHandler('fromSiteIds')}
        onClearAll={makeClearHandler('fromSiteIds')}
      />

      {/* Destination Sites */}
      <ScopeFilterSection
        id="all-to-sites"
        label="Destination Sites"
        allChecked={scope.allToSites}
        selectedIds={scope.toSiteIds}
        options={sites}
        onAllChange={makeAllHandler('allToSites', 'toSiteIds')}
        onToggle={makeToggleHandler('toSiteIds')}
        onClearAll={makeClearHandler('toSiteIds')}
      />

      {/* Origin Regions */}
      <ScopeFilterSection
        id="all-from-regions"
        label="Origin Regions"
        allChecked={scope.allFromRegions}
        selectedIds={scope.fromRegionIds}
        options={regions}
        onAllChange={makeAllHandler('allFromRegions', 'fromRegionIds')}
        onToggle={makeToggleHandler('fromRegionIds')}
        onClearAll={makeClearHandler('fromRegionIds')}
      />

      {/* Destination Regions */}
      <ScopeFilterSection
        id="all-to-regions"
        label="Destination Regions"
        allChecked={scope.allToRegions}
        selectedIds={scope.toRegionIds}
        options={regions}
        onAllChange={makeAllHandler('allToRegions', 'toRegionIds')}
        onToggle={makeToggleHandler('toRegionIds')}
        onClearAll={makeClearHandler('toRegionIds')}
      />

      {/* Time Threshold */}
      <div className="auto-scope-group">
        <label className="auto-label-text" style={{ fontWeight: 500 }}>Time Threshold (minutes)</label>
        <input
          type="number"
          value={scope.timeThreshold ?? ''}
          onChange={(e) =>
            onChange({ ...scope, timeThreshold: e.target.value ? parseInt(e.target.value, 10) : undefined })
          }
          placeholder="e.g. 15"
          className="input auto-input-sm"
          style={{ width: '100%', marginTop: 4 }}
          min={0}
        />
        <div className="auto-label-xs" style={{ marginTop: 2 }}>
          Job must be in state for at least X minutes before rule fires.
        </div>
      </div>

      {/* Scope Summary */}
      <div className="auto-scope-summary">
        <strong>Scope:</strong>{' '}
        {filterSummaryParts.length === 0 ? (
          'This automation applies to all jobs.'
        ) : (
          <>
            Filtered to{' '}
            {filterSummaryParts.map((part, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <span className="auto-scope-count">{part}</span>
              </span>
            ))}
            .
          </>
        )}
        {scope.timeThreshold != null && scope.timeThreshold > 0 && (
          <> Time threshold: <span className="auto-scope-count">{scope.timeThreshold} min</span>.</>
        )}
      </div>
    </div>
  );
}
