import { useId } from "react";
import { browseGenres } from "../data/genres";
import type { SearchParams } from "../lib/search";

interface SearchFiltersProps {
  value: SearchParams;
  onChange: (next: SearchParams) => void;
  /** Kids profiles search only BookWorm's own shelf, so they don't choose a source. */
  showSource: boolean;
}

interface Option<T> {
  value: T;
  label: string;
}

function ChipGroup<T extends string | null>({
  legend,
  options,
  current,
  onPick,
}: {
  legend: string;
  options: Option<T>[];
  current: T;
  onPick: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      <div className="chip-group">
        {options.map((o) => (
          <label key={o.value ?? "any"} className="chip">
            <input type="radio" name={name} checked={current === o.value} onChange={() => onPick(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Narrow a title search: where results come from, one of the six genres, and the order. */
export function SearchFilters({ value, onChange, showSource }: SearchFiltersProps) {
  return (
    <div className="search-filters">
      {showSource && (
        <ChipGroup
          legend="Show"
          current={value.source}
          options={[
            { value: "all", label: "All results" },
            { value: "bookworm", label: "BookWorm titles" },
            { value: "google", label: "Google Books" },
          ]}
          onPick={(source) => onChange({ ...value, source })}
        />
      )}
      <ChipGroup
        legend="Genre"
        current={value.genre}
        options={[{ value: null, label: "Any genre" }, ...browseGenres.map((g) => ({ value: g.id, label: g.label }))]}
        onPick={(genre) => onChange({ ...value, genre })}
      />
      <ChipGroup
        legend="Sort by"
        current={value.sort}
        options={[
          { value: "relevance", label: "Best match" },
          { value: "newest", label: "Newest" },
        ]}
        onPick={(sort) => onChange({ ...value, sort })}
      />
    </div>
  );
}
