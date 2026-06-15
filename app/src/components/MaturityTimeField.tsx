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

type Props = {
  onChange: (unixSec: number) => void;
};

export function MaturityTimeField({ onChange }: Props) {
  const t = useT();
  const userTz = useMemo(() => detectUserTimezone(), []);
  const timezoneOptions = useMemo(() => buildTimezoneOptions(userTz), [userTz]);

  const [timeZone, setTimeZone] = useState(userTz);
  const [localValue, setLocalValue] = useState(() => defaultMaturityZonedInput(userTz));

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
      <label htmlFor="maturity-tz">{t("createMarket.maturity.timezone")}</label>
      <select
        id="maturity-tz"
        value={timeZone}
        onChange={(e) => handleTimezoneChange(e.target.value)}
      >
        {timezoneOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label htmlFor="maturity">{t("createMarket.maturity.maturity")}</label>
      <input
        id="maturity"
        type="datetime-local"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />

      <p className="hint">{t("createMarket.maturity.hint")}</p>

      {valid && (
        <div className="maturity-time-ref">
          <p className="hint" style={{ marginTop: "0.35rem" }}>
            {t("createMarket.maturity.chainUtc")}{" "}
            <code className="mono">{formatUtcDisplay(unixSec)}</code>
          </p>
          {userTz !== timeZone && (
            <p className="hint" style={{ marginTop: "0.35rem" }}>
              {t("createMarket.maturity.yourTz", {
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
