// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

"use client";

import { useLocalizedTagLabel } from "@/i18n/markets";
import { useT } from "@/i18n/context";

type Props = {
  tags?: string[];
  max?: number;
  className?: string;
};

export function MarketTagList({ tags, max = 4, className }: Props) {
  const tagLabel = useLocalizedTagLabel();
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
  const t = useT();
  const toggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div className="market-tag-picker" role="group" aria-label={t("marketTag.pickerAria")}>
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
