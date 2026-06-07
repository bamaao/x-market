import { MarketsGrid } from "@/components/MarketsGrid";

export default function HomePage() {
  return (
    <>
      <h1>市场</h1>
      <p className="sub">链上市场发现 — Indexer API 或环境变量种子市场</p>
      <MarketsGrid />
    </>
  );
}
