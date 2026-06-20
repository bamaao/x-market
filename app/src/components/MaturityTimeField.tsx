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

import { useEffect, useMemo, useState } from "react";
import {
  buildTimezoneOptions,
  defaultMaturityZonedInput,
  detectUserTimezone,
  formatUtcDisplay,
  formatZonedDatetimeInput,
  parseZonedDatetimeInput,
  timezoneLabel,
} from "@/lib/market-maturity-time";
import { useT } from "@/i18n/context";

export type DatetimeFieldI18nPrefix = "createMarket.maturity" | "createMarket.auctionEnd";

type Props = {
  onChange: (unixSec: number) => void;
  /** i18n key prefix for labels and hints */
  i18nPrefix?: DatetimeFieldI18nPrefix;
  /** Initial wall-clock value (`datetime-local` string) */
  initialLocalValue?: string;
  /** HTML id prefix for inputs (defaults from i18nPrefix) */
  idPrefix?: string;
};

function fieldKey(prefix: DatetimeFieldI18nPrefix, suffix: string): string {
  if (suffix === "datetime" && prefix === "createMarket.maturity") {
    return `${prefix}.maturity`;
  }
  return `${prefix}.${suffix}`;
}

export function MaturityTimeField({
  onChange,
  i18nPrefix = "createMarket.maturity",
  initialLocalValue,
  idPrefix,
}: Props) {
  const t = useT();
  const userTz = useMemo(() => detectUserTimezone(), []);
  const timezoneOptions = useMemo(() => buildTimezoneOptions(userTz), [userTz]);

  const [timeZone, setTimeZone] = useState(userTz);
  const [localValue, setLocalValue] = useState(
    () => initialLocalValue ?? defaultMaturityZonedInput(userTz),
  );
  const resolvedIdPrefix = idPrefix ?? (i18nPrefix === "createMarket.auctionEnd" ? "auction" : "maturity");

  const unixSec = useMemo(
    () => parseZonedDatetimeInput(localValue, timeZone),
    [localValue, timeZone],
  );

  useEffect(() => {
    if (Number.isFinite(unixSec)) onChange(unixSec);
  }, [unixSec, onChange]);

  const handleTimezoneChange = (nextTz: string) => {
    const ts = parseZonedDatetimeInput(localValue, timeZone);
    if (Number.isFinite(ts)) {
      setLocalValue(formatZonedDatetimeInput(ts, nextTz));
    }
    setTimeZone(nextTz);
  };

  const valid = Number.isFinite(unixSec);

  return (
    <div className="maturity-time-field">
      <label htmlFor={`${resolvedIdPrefix}-tz`}>{t(fieldKey(i18nPrefix, "timezone"))}</label>
      <select
        id={`${resolvedIdPrefix}-tz`}
        value={timeZone}
        onChange={(e) => handleTimezoneChange(e.target.value)}
      >
        {timezoneOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label htmlFor={resolvedIdPrefix}>{t(fieldKey(i18nPrefix, "datetime"))}</label>
      <input
        id={resolvedIdPrefix}
        type="datetime-local"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />

      <p className="hint">{t(fieldKey(i18nPrefix, "hint"))}</p>

      {valid && (
        <div className="maturity-time-ref">
          <p className="hint" style={{ marginTop: "0.35rem" }}>
            {t(fieldKey(i18nPrefix, "chainUtc"))}{" "}
            <code className="mono">{formatUtcDisplay(unixSec)}</code>
          </p>
          {userTz !== timeZone && (
            <p className="hint" style={{ marginTop: "0.35rem" }}>
              {t(fieldKey(i18nPrefix, "yourTz"), {
                label: timezoneLabel(userTz, new Date(unixSec * 1000)),
              })}{" "}
              <code className="mono">{formatZonedDatetimeInput(unixSec, userTz).replace("T", " ")}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
