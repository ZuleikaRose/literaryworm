import { useId } from "react";
import { tk } from "../lib/i18n";
import { useBrowseGenres } from "../lib/useBrowseGenres";
import { useT } from "../lib/useT";
import { hasAllFilters, SEARCH_LANGUAGES, SEARCH_LENGTHS, type SearchParams } from "../lib/search";

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
  const t = useT();
  return (
    <fieldset className="filter-group">
      <legend>{t(legend)}</legend>
      <div className="chip-group">
        {options.map((o) => (
          <label key={o.value ?? "any"} className="chip">
            <input type="radio" name={name} checked={current === o.value} onChange={() => onPick(o.value)} />
            <span>{t(o.label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Narrow a search: where results come from, a genre, language, length, and the order (by title or
 * keywords). A search by author has only where results come from and length (Google's author search has no others).
 */
export function SearchFilters({ value, onChange, showSource }: SearchFiltersProps) {
  const genres = useBrowseGenres();
  return (
    <div className="search-filters">
      {showSource && (
        <ChipGroup
          legend={tk("Show")}
          current={value.source}
          options={[
            { value: "all", label: tk("All results") },
            { value: "literaryworm", label: tk("LiteraryWorm titles") },
            { value: "google", label: tk("Google Books") },
          ]}
          onPick={(source) => onChange({ ...value, source })}
        />
      )}
      {hasAllFilters(value.by) && (
        <>
          <ChipGroup
            legend={tk("Genre")}
            current={value.genre}
            options={[{ value: null, label: tk("Any genre") }, ...genres.map((g) => ({ value: g.id, label: g.label }))]}
            onPick={(genre) => onChange({ ...value, genre })}
          />
          <ChipGroup
            legend={tk("Language")}
            current={value.lang}
            options={[{ value: null, label: tk("Any language") }, ...SEARCH_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))]}
            onPick={(lang) => onChange({ ...value, lang })}
          />
        </>
      )}
      <ChipGroup
        legend={tk("Length")}
        current={value.length}
        options={[{ value: null, label: tk("Any length") }, ...SEARCH_LENGTHS.map((l) => ({ value: l.id, label: l.label }))]}
        onPick={(length) => onChange({ ...value, length })}
      />
      {hasAllFilters(value.by) && (
        <ChipGroup
          legend={tk("Sort by")}
          current={value.sort}
          options={[
            { value: "relevance", label: tk("Best match") },
            { value: "newest", label: tk("Newest") },
          ]}
          onPick={(sort) => onChange({ ...value, sort })}
        />
      )}
    </div>
  );
}
