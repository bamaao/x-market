"use client";

import Link from "next/link";
import { MarketsGrid } from "@/components/MarketsGrid";
import { useT } from "@/i18n/context";

export function HomePageContent() {
  const t = useT();

  return (
    <>
      <section className="hero">
        <p className="hero-eyebrow">{t("home.eyebrow")}</p>
        <h1>{t("home.title")}</h1>
        <p className="hero-desc">{t("home.desc")}</p>
        <div className="hero-features">
          <span className="hero-pill">
            <strong>{t("home.pillPositions")}</strong> {t("home.pillPositionsSub")}
          </span>
          <span className="hero-pill">
            <strong>{t("home.pillPricing")}</strong> {t("home.pillPricingSub")}
          </span>
          <span className="hero-pill">
            <strong>{t("home.pillProphet")}</strong> {t("home.pillProphetSub")}
          </span>
        </div>
        <div className="hero-actions">
          <Link href="/positions" className="hero-link primary">
            {t("home.viewPositions")}
          </Link>
          <Link href="/prophet" className="hero-link secondary">
            {t("home.prophetLink")}
          </Link>
          <Link href="/oracle" className="hero-link secondary">
            {t("home.oracleLink")}
          </Link>
        </div>
      </section>

      <div className="section-head">
        <h2>{t("home.activeMarkets")}</h2>
        <Link href="/markets/create" className="hero-link primary">
          {t("home.createMarket")}
        </Link>
      </div>
      <MarketsGrid />
    </>
  );
}
