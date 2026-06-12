"use client";

import { tagLabel } from "@/lib/market-tags";

type Props = {
  tags?: string[];
  max?: number;
  className?: string;
};

export function MarketTagList({ tags, max = 4, className }: Props) {
  if (!tags?.length) return null;
  const shown = tags.slice(0, max);
  return (
    <div className={`market-tag-list${className ? ` ${className}` : ""}`}>
      {shown.map((slug) => (
        <span key={slug} className="market-tag-chip">
          {tagLabel(slug)}
        </span>
      ))}
      {tags.length > max && (
        <span className="market-tag-chip market-tag-chip--more">+{tags.length - max}</span>
      )}
    </div>
  );
}

type PickerProps = {
  selected: string[];
  onChange: (tags: string[]) => void;
  options: { slug: string; label: string }[];
};

export function MarketTagPicker({ selected, onChange, options }: PickerProps) {
  const toggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div className="market-tag-picker" role="group" aria-label="市场主题">
      {options.map((t) => {
        const active = selected.includes(t.slug);
        return (
          <button
            key={t.slug}
            type="button"
            className={`market-tag-chip market-tag-chip--pick${active ? " active" : ""}`}
            aria-pressed={active}
            onClick={() => toggle(t.slug)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
