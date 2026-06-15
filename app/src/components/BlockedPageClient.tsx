"use client";

import { useT } from "@/i18n/context";

export default function BlockedPageClient({
  country,
}: {
  country?: string;
}) {
  const t = useT();

  return (
    <div className="card" style={{ maxWidth: 480, margin: "4rem auto" }}>
      <h1>{t("blocked.title")}</h1>
      <p>{t("blocked.body", { country: country ?? t("common.unknown") })}</p>
      <p className="hint">{t("blocked.hint")}</p>
    </div>
  );
}
