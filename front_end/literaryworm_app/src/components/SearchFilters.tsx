import { useId } from "react";
import { browseGenres } from "../data/genres";
import { SEARCH_LANGUAGES, SEARCH_LENGTHS, type SearchParams } from "../lib/search";

interface SearchFiltersProps {
  value: SearchParams;
  onChange: (next: SearchParams) => void;
  /** Kids profiles search only LiteraryWorm's own shelf, so they don't choose a source. */
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

/**
 * Narrow a search: where results come from, a genre, language, length, and the order. A search
 * by author has only where results come from and length (Google's author search has no others).
 */
export function SearchFilters({ value, onChange, showSource }: SearchFiltersProps) {
  return (
    <div className="search-filters">
      {showSource && (
        <ChipGroup
          legend="Show"
          current={value.source}
          options={[
            { value: "all", label: "All results" },
            { value: "literaryworm", label: "LiteraryWorm titles" },
            { value: "google", label: "Google Books" },
          ]}
          onPick={(source) => onChange({ ...value, source })}
        />
      )}
      {value.by === "title" && (
        <>
          <ChipGroup
            legend="Genre"
            current={value.genre}
            options={[{ value: null, label: "Any genre" }, ...browseGenres.map((g) => ({ value: g.id, label: g.label }))]}
            onPick={(genre) => onChange({ ...value, genre })}
          />
          <ChipGroup
            legend="Language"
            current={value.lang}
            options={[{ value: null, label: "Any language" }, ...SEARCH_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))]}
            onPick={(lang) => onChange({ ...value, lang })}
          />
        </>
      )}
      <ChipGroup
        legend="Length"
        current={value.length}
        options={[{ value: null, label: "Any length" }, ...SEARCH_LENGTHS.map((l) => ({ value: l.id, label: l.label }))]}
        onPick={(length) => onChange({ ...value, length })}
      />
      {value.by === "title" && (
        <ChipGroup
          legend="Sort by"
          current={value.sort}
          options={[
            { value: "relevance", label: "Best match" },
            { value: "newest", label: "Newest" },
          ]}
          onPick={(sort) => onChange({ ...value, sort })}
        />
      )}
    </div>
  );
}
