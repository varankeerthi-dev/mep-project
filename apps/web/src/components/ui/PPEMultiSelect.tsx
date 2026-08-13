import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_OPTIONS = [
  "Helmet",
  "Safety Shoes",
  "Harness",
  "Work Permit",
  "Escort Required",
];

interface PPEMultiSelectProps {
  value: string; // comma-separated string
  onChange: (value: string) => void;
  className?: string;
}

/** Parse a comma-separated string into { presets: string[], others: string } */
function parseValue(raw: string) {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const presets = parts.filter((p) => PRESET_OPTIONS.includes(p));
  const others = parts
    .filter((p) => !PRESET_OPTIONS.includes(p))
    .join(", ");

  return { presets, others };
}

/** Serialise back to comma-separated string */
function serialise(presets: string[], others: string): string {
  const parts = [...presets];
  const trimmed = others.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(", ");
}

export function PPEMultiSelect({ value, onChange, className }: PPEMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { presets: initPresets, others: initOthers } = React.useMemo(
    () => parseValue(value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [selected, setSelected] = React.useState<string[]>(initPresets);
  const [othersChecked, setOthersChecked] = React.useState(!!initOthers);
  const [othersText, setOthersText] = React.useState(initOthers);

  // Sync outward whenever local state changes
  React.useEffect(() => {
    const othersValue = othersChecked ? othersText : "";
    onChange(serialise(selected, othersValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, othersChecked, othersText]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function togglePreset(option: string) {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }

  function removeChip(label: string) {
    if (PRESET_OPTIONS.includes(label)) {
      setSelected((prev) => prev.filter((o) => o !== label));
    } else {
      // it's the "others" chip
      setOthersText("");
      setOthersChecked(false);
    }
  }

  // Build display chips
  const chips = [
    ...selected,
    ...(othersChecked && othersText.trim() ? [othersText.trim()] : []),
  ];

  const hasSelections = selected.length > 0 || (othersChecked && othersText.trim());

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors text-left",
          "hover:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {hasSelections ? (
            chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-md bg-accent text-accent-foreground text-xs px-1.5 py-0.5 font-medium"
              >
                {chip}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
                  className="text-accent-foreground/60 hover:text-accent-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">Select PPE requirements</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[99999] w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-1">
            {PRESET_OPTIONS.map((option) => {
              const isChecked = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => togglePreset(option)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  {/* Checkbox indicator */}
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      isChecked
                        ? "bg-primary border-primary"
                        : "border-input bg-transparent"
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  {option}
                </button>
              );
            })}

            {/* Divider */}
            <div className="my-1 border-t border-border" />

            {/* Others */}
            <button
              type="button"
              onClick={() => setOthersChecked((c) => !c)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  othersChecked
                    ? "bg-primary border-primary"
                    : "border-input bg-transparent"
                )}
              >
                {othersChecked && <Check className="h-3 w-3 text-primary-foreground" />}
              </span>
              Others
            </button>

            {othersChecked && (
              <div className="px-3 pb-2">
                <input
                  autoFocus
                  type="text"
                  value={othersText}
                  onChange={(e) => setOthersText(e.target.value)}
                  placeholder="e.g. Face Shield, Gloves"
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
