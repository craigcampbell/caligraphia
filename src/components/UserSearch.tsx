"use client";

import { useState, useEffect, useRef } from "react";

interface UserResult {
  id: string;
  username: string;
  nomDePlume: string | null;
}

interface Props {
  onSelect: (user: UserResult) => void;
  placeholder?: string;
}

export function UserSearch({ onSelect, placeholder = "Search by username..." }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.users || []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = (user: UserResult) => {
    setSelected(user);
    setQuery(user.username);
    setResults([]);
    onSelect(user);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onSelect({ id: "", username: "", nomDePlume: null });
  };

  return (
    <div className="user-search">
      {selected ? (
        <div className="us-selected">
          {selected.nomDePlume ? (
            <img src={selected.nomDePlume} alt="" className="us-av" width={20} height={20} />
          ) : (
            <span className="us-av-ph">{selected.username[0].toUpperCase()}</span>
          )}
          <span className="us-name">{selected.username}</span>
          <button onClick={handleClear} className="us-clear">&times;</button>
        </div>
      ) : (
        <div className="us-input-wrap">
          <span className="us-prefix">To:</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="us-input"
            data-allow-text="true"
            id="user-search-input"
          />
          {searching && <span className="us-spinner" />}
          {results.length > 0 && (
            <div className="us-dropdown">
              {results.map((u) => (
                <button key={u.id} className="us-option" onClick={() => handleSelect(u)}>
                  {u.nomDePlume ? (
                    <img src={u.nomDePlume} alt="" className="us-av" width={18} height={18} />
                  ) : (
                    <span className="us-av-ph-sm">{u.username[0].toUpperCase()}</span>
                  )}
                  <span className="us-opt-name">{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .user-search { width: 100%; }
        .us-selected {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f0e8d8;
          border: 1px solid #d0c8b8;
          border-radius: 8px;
          font-size: 14px;
        }
        .us-av { border-radius: 50%; object-fit: cover; }
        .us-av-ph, .us-av-ph-sm {
          border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-weight: 600;
        }
        .us-av-ph { width: 20px; height: 20px; background: #d0c8b8; font-size: 10px; color: #5c4a30; }
        .us-av-ph-sm { width: 18px; height: 18px; background: #d0c8b8; font-size: 9px; color: #5c4a30; }
        .us-name { font-weight: 600; color: #2c2416; flex: 1; }
        .us-clear {
          background: none; border: none; color: #8c7a60; cursor: pointer;
          font-size: 18px; padding: 0 4px; font-family: inherit;
        }
        .us-clear:hover { color: #1a1a1a; }
        .us-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1.5px solid #d0c8b8;
          border-radius: 6px;
          background: #fefdf9;
        }
        .us-input-wrap:focus-within { border-color: #8b4513; }
        .us-prefix { font-size: 13px; color: #b0a090; font-weight: 500; }
        .us-input {
          flex: 1; border: none; outline: none; font-size: 14px;
          font-family: inherit; color: #2c2416; background: transparent;
        }
        .us-input::placeholder { color: #c0b8a8; font-style: italic; }
        .us-spinner {
          width: 14px; height: 14px; border: 2px solid #e0d5c0;
          border-top-color: #8b4513; border-radius: 50%;
          animation: us-spin 0.6s linear infinite;
        }
        @keyframes us-spin { to { transform: rotate(360deg); } }
        .us-dropdown {
          position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
          margin-top: 4px; border: 1px solid #e0d5c0; border-radius: 6px;
          background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          max-height: 200px; overflow-y: auto;
        }
        .us-option {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 10px 14px; border: none; background: none; cursor: pointer;
          font-family: inherit; font-size: 14px; text-align: left; color: #2c2416;
        }
        .us-option:hover { background: #faf6ee; }
        .us-option:first-child { border-radius: 6px 10px 0 0; }
        .us-option:last-child { border-radius: 0 0 10px 10px; }
        .us-opt-name { font-weight: 500; }
      `}</style>
    </div>
  );
}
