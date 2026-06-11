import Link from "next/link";
import { MarketsGrid } from "@/components/MarketsGrid";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="hero-eyebrow">Sui Testnet · PDF 预测市场</p>
        <h1>对象化头寸，并行定价</h1>
        <p className="hero-desc">
          在 Sui 链上交易 Poisson、Dirichlet、Normal、Beta
          分布预测市场。每笔头寸是独立对象，支持 LP 做市、保证金与 Oracle 结算。
        </p>
        <div className="hero-features">
          <span className="hero-pill">
            <strong>链上头寸</strong> NFT 式 Position
          </span>
          <span className="hero-pill">
            <strong>并行定价</strong> Tier-1 PMF/CDF
          </span>
          <span className="hero-pill">
            <strong>Prophet</strong> Seal 加密预言
          </span>
        </div>
        <div className="hero-actions">
          <Link href="/positions" className="hero-link primary">
            查看持仓
          </Link>
          <Link href="/prophet" className="hero-link secondary">
            Prophet 预言
          </Link>
          <Link href="/oracle" className="hero-link secondary">
            Oracle 结算
          </Link>
        </div>
      </section>

      <div className="section-head">
        <h2>活跃市场</h2>
        <Link href="/markets/create" className="hero-link primary">
          创建市场
        </Link>
      </div>
      <MarketsGrid />
    </>
  );
}
