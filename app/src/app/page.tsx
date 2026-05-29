import Link from "next/link";
import { SEED_MARKETS } from "@/lib/markets";

export default function HomePage() {
  return (
    <>
      <h1>市场</h1>
      <p className="sub">Phase 1 MVP — 3 个 Testnet 种子市场模板</p>

      <div className="grid">
        {SEED_MARKETS.map((m) => (
          <article key={m.id} className="card">
            <span className="badge">{m.kind}</span>
            <h2>{m.title}</h2>
            <p>{m.description}</p>
            <Link href={`/markets/${m.id}`}>交易 →</Link>
          </article>
        ))}
      </div>
    </>
  );
}
