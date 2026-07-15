import { useState, useRef, useEffect, useCallback } from "react";

export interface Option {
  id?: string;
  code?: string;
  name: string;
  description?: string;
  hex?: string;
  backsetType?: string;
  [key: string]: unknown;
}

function optionKey(opt: Option): string {
  return opt.id ?? opt.code ?? opt.name;
}

/** Format an option as "{code} — {name}" when code exists, otherwise just the name.
 * Also appends backsetType if present. */
function formatOption(opt: Option, displayKey: string): string {
  const name = (opt[displayKey] as string) || opt.name;
  let formatted = opt.code ? `${opt.code} — ${name}` : name;
  if (opt.backsetType) {
    formatted += ` — ${opt.backsetType}`;
  }
  return formatted;
}

interface SearchableSelectProps {
  label: string;
  options: Option[];
  value: Option | null;
  onChange: (option: Option | null) => void;
  placeholder?: string;
  disabled?: boolean;
  displayKey?: string;
  /** If true, shows code in the selected value display */
  showCode?: boolean;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  displayKey = "name",
  showCode = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) => {
    const q = search.toLowerCase();
    return (
      opt.name.toLowerCase().includes(q) ||
      (opt.code && opt.code.toLowerCase().includes(q)) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  const handleSelect = useCallback(
    (opt: Option) => {
      onChange(opt);
      setSearch("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) {
          handleSelect(filtered[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    if (isOpen && listRef.current) {
      const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputRef.current && !inputRef.current.parentElement?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Compute the display text for the selected value
  const displayValue = value
    ? showCode && value.code
      ? `${value.code} — ${(value[displayKey] as string) || value.name}${value.backsetType ? ` — ${value.backsetType}` : ""}`
      : (value[displayKey] as string) || value.name
    : "";

  return (
    <div className="searchable-select">
      <label className="label-text">{label}</label>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        placeholder={value ? displayValue : placeholder}
        title={value?.description ? `${value.name} — ${value.description}${value.backsetType ? ` (${value.backsetType})` : ""}` : undefined}
        value={isOpen ? search : ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch("");
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
        style={{
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      <svg
        className="pointer-events-none absolute right-3 top-[calc(1.5rem+10px)] h-4 w-4 transition-transform"
        style={{
          color: "var(--text-muted)",
          transform: isOpen ? "rotate(180deg)" : undefined,
        }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      {value?.description && !isOpen && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", paddingLeft: "2px" }}>
          {value.description}
        </p>
      )}
      {isOpen && !disabled && (
        <div ref={listRef} className="dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
              No matches found
            </div>
          ) : (
            (() => {
              // Check if options have backsetType — if so, group by it
              const hasBacksetTypes = filtered.some((o) => o.backsetType);
              if (hasBacksetTypes) {
                // Group by backsetType
                const groups: Record<string, Option[]> = {};
                for (const opt of filtered) {
                  const g = opt.backsetType || "other";
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(opt);
                }
                // Sort groups: commercial first, then residential, then others
                const groupOrder = ["commercial", "residential"];
                const sortedGroups = Object.keys(groups).sort(
                  (a, b) => {
                    const ai = groupOrder.indexOf(a);
                    const bi = groupOrder.indexOf(b);
                    return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
                  }
                );
                // Track absolute index for active index
                let absIdx = 0;
                return sortedGroups.map((groupName) => {
                  const grpOptions = groups[groupName];
                  const label = groupName === "commercial" ? "Commercial Application" : groupName === "residential" ? "Residential Application" : groupName;
                  return (
                    <div key={groupName}>
                      <div
                        className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}
                      >
                        {label}
                      </div>
                      {grpOptions.map((opt) => {
                        const isSelected = value ? optionKey(value) === optionKey(opt) : false;
                        const format = formatOption(opt, displayKey);
                        const currentIdx = absIdx++;
                        return (
                          <div
                            key={optionKey(opt)}
                            role="option"
                            aria-selected={isSelected}
                            className={`option ${isSelected ? "selected" : ""} ${currentIdx === activeIndex ? "active" : ""}`}
                            onClick={() => handleSelect(opt)}
                            onMouseEnter={() => setActiveIndex(currentIdx)}
                          >
                            <div className="flex items-center gap-2">
                              {opt.hex && (
                                <span
                                  className="inline-block h-4 w-4 shrink-0 rounded-full border"
                                  style={{ backgroundColor: opt.hex, borderColor: "var(--border-color)" }}
                                />
                              )}
                              <div>
                                <span className="font-medium">{format}</span>
                              </div>
                            </div>
                            {opt.description && (
                              <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                                {opt.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              } else {
                // No backset types — render flat list
                return filtered.map((opt, idx) => {
                  const isSelected = value ? optionKey(value) === optionKey(opt) : false;
                  const format = formatOption(opt, displayKey);
                  return (
                    <div
                      key={optionKey(opt)}
                      role="option"
                      aria-selected={isSelected}
                      className={`option ${isSelected ? "selected" : ""} ${idx === activeIndex ? "active" : ""}`}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="flex items-center gap-2">
                        {opt.hex && (
                          <span
                            className="inline-block h-4 w-4 shrink-0 rounded-full border"
                            style={{ backgroundColor: opt.hex, borderColor: "var(--border-color)" }}
                          />
                        )}
                        <div>
                          <span className="font-medium">{format}</span>
                        </div>
                      </div>
                      {opt.description && (
                        <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                  );
                });
              }
            })()
          )}
        </div>
      )}
    </div>
  );
}