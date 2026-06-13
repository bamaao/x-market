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

type Props = {
  onChange: (unixSec: number) => void;
};

export function MaturityTimeField({ onChange }: Props) {
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
      <label htmlFor="maturity-tz">时区</label>
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

      <label htmlFor="maturity">到期时间</label>
      <input
        id="maturity"
        type="datetime-local"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />

      <p className="hint">
        上方时间为所选时区的<strong>本地墙钟时间</strong>；链上统一写入{" "}
        <strong>UTC 标准时间</strong>（Unix 秒，与 Oracle / Prophet 对齐）。
      </p>

      {valid && (
        <div className="maturity-time-ref">
          <p className="hint" style={{ marginTop: "0.35rem" }}>
            链上 UTC 标准时间：<code className="mono">{formatUtcDisplay(unixSec)}</code>
          </p>
          {userTz !== timeZone && (
            <p className="hint" style={{ marginTop: "0.35rem" }}>
              您的系统时区（{timezoneLabel(userTz, new Date(unixSec * 1000))}）：{" "}
              <code className="mono">{formatZonedDatetimeInput(unixSec, userTz).replace("T", " ")}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
