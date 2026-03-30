import { useState, useRef, useEffect, useCallback } from 'react';

type Option = { id: string; name: string; shortName?: string };

interface SearchableSelectProps {
  /** Pre-loaded options for client-side filtering. Ignored when onSearch is provided. */
  options?: Option[];
  /** Server-side search callback. When provided, options are fetched on each keystroke. */
  onSearch?: (query: string) => Promise<Option[]>;
  /** Currently selected value, or 'all' for no selection */
  value: string;
  /** Display name for the currently selected value (needed when options aren't preloaded) */
  selectedLabel?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

/**
 * A searchable dropdown that filters options by name as the user types.
 * Supports both client-side filtering (via options prop) and server-side
 * search (via onSearch prop) for large datasets.
 */
export function SearchableSelect({
  options,
  onSearch,
  value,
  selectedLabel,
  onChange,
  placeholder = 'Search...',
  allLabel = 'All',
  className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Option[]>([]);
  const [searching, setSearching] = useState(false);
  const [lastSelectedName, setLastSelectedName] = useState(selectedLabel || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isServerSide = !!onSearch;

  // Resolve display value for current selection
  const selectedOption = options?.find((o) => o.id === value);
  const displayValue = value === 'all'
    ? ''
    : selectedLabel || lastSelectedName || selectedOption?.name || selectedOption?.shortName || '';

  // Client-side filtering
  const clientFiltered = !isServerSide && query
    ? (options || []).filter(
        (o) =>
          o.name.toLowerCase().includes(query.toLowerCase()) ||
          (o.shortName && o.shortName.toLowerCase().includes(query.toLowerCase())),
      )
    : (options || []);

  const results = isServerSide ? searchResults : clientFiltered;

  // Server-side search with debounce
  const doSearch = useCallback(
    (q: string) => {
      if (!onSearch) return;
      if (q.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      onSearch(q).then((data) => {
        setSearchResults(data);
        setSearching(false);
      });
    },
    [onSearch],
  );

  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (!isOpen) setIsOpen(true);
    if (isServerSide) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(q), 250);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string, name: string) => {
    setLastSelectedName(name);
    onChange(id);
    setQuery('');
    setSearchResults([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLastSelectedName('');
    onChange('all');
    setQuery('');
    setSearchResults([]);
    setIsOpen(false);
  };

  const showResults = isServerSide ? query.length >= 2 : true;

  return (
    <div ref={containerRef} className={`auto-searchable-select ${className || ''}`}>
      <div className="auto-searchable-input-wrap">
        <input
          className="input auto-searchable-input"
          value={isOpen ? query : displayValue}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
            if (isServerSide) setSearchResults([]);
          }}
          placeholder={value === 'all' ? placeholder : ''}
        />
        {value !== 'all' && (
          <button
            type="button"
            className="auto-searchable-clear"
            onClick={handleClear}
            title={`Reset to ${allLabel}`}
          >
            ✕
          </button>
        )}
      </div>
      {isOpen && (
        <div className="auto-searchable-dropdown">
          <button
            type="button"
            className={`auto-searchable-option${value === 'all' ? ' selected' : ''}`}
            onClick={handleClear}
          >
            {allLabel}
          </button>
          {isServerSide && query.length > 0 && query.length < 2 && (
            <div className="auto-searchable-empty">Type at least 2 characters to search</div>
          )}
          {searching && (
            <div className="auto-searchable-empty">Searching...</div>
          )}
          {showResults && !searching && results.length === 0 && query.length >= 2 && (
            <div className="auto-searchable-empty">No matches</div>
          )}
          {showResults && !searching && results.slice(0, 20).map((o) => (
            <button
              key={o.id}
              type="button"
              className={`auto-searchable-option${o.id === value ? ' selected' : ''}`}
              onClick={() => handleSelect(o.id, o.name)}
            >
              <span className="auto-searchable-name">{o.name}</span>
              {o.shortName && o.shortName !== o.name && (
                <span className="auto-searchable-code">{o.shortName}</span>
              )}
            </button>
          ))}
          {showResults && results.length > 20 && (
            <div className="auto-searchable-empty">
              {results.length - 20} more — type to narrow results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
