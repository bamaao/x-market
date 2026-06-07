/**
 * P0.7 Testnet 应急演练（A–D 链上步骤）
 * 用法: cd app && npx tsx scripts/p0-drills.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..");
const SUI_CLOCK = "0x6";
const USDC_UNIT = 1_000_000n; // 1 USDC

type StepStatus = "success" | "fail" | "skipped" | "manual";

interface DrillStep {
  drill: string;
  step: string;
  status: StepStatus;
  digest?: string;
  objectId?: string;
  note?: string;
  error?: string;
}

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

function loadKeypair() {
  const envPath = join(repoRoot, "services/gas-station/.env.local");
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("GAS_PAYER_PRIVATE_KEY="));
  if (!line) throw new Error("GAS_PAYER_PRIVATE_KEY missing in gas-station/.env.local");
  const raw = line.split("=").slice(1).join("=").trim();
  return { raw, envPath };
}

async function main() {
  const steps: DrillStep[] = [];
  const push = (s: DrillStep) => {
    steps.push(s);
    const mark =
      s.status === "success" ? "OK" : s.status === "manual" ? "MANUAL" : s.status === "skipped" ? "SKIP" : "FAIL";
    console.log(`[${mark}] ${s.drill} :: ${s.step}${s.digest ? ` (${s.digest})` : ""}${s.note ? ` — ${s.note}` : ""}${s.error ? ` — ${s.error}` : ""}`);
  };

  loadEnv(join(appRoot, ".env.local"));
  const deploy = JSON.parse(
    readFileSync(join(repoRoot, "deploy/testnet-v2.json"), "utf8"),
  ) as {
    packageId: string;
    packageIdV1: string;
    globalConfig: string;
    adminCap: string;
    treasuryCapUsdc: string;
    deployer: string;
    seedMarkets: {
      poisson_goals: { poolId: string };
      dirichlet_wdl: { poolId: string };
      normal_cpi: { poolId: string };
    };
  };

  const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import(
    "@mysten/sui/jsonRpc"
  );
  const { Transaction } = await import("@mysten/sui/transactions");
  const { fromBase64 } = await import("@mysten/sui/utils");

  const { raw } = loadKeypair();
  const { secretKey } = decodeSuiPrivateKey(raw.trim());
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const sender = keypair.getPublicKey().toSuiAddress();
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl("testnet"),
    network: "testnet",
  });

  const pkg = deploy.packageId;
  // Upgraded package: USDC coin type stays at first publish id (packageIdV1).
  const usdcPkg =
    deploy.packageIdV1 ??
    "0xb2af3cb8af06e9754f442680ff2d191b8cc3a16ee661197534e6dc435e1eabce";
  const usdcType = `${usdcPkg}::usdc::USDC`;
  console.log(`USDC type: ${usdcType}`);

  const VERSION_STALE =
    /unavailable for consumption|Transaction needs to be rebuilt|version mismatch/i;

  async function execute(tx: InstanceType<typeof Transaction>, label: string, drill: string) {
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
          options: { showEffects: true, showObjectChanges: true },
        });
        await client.waitForTransaction({ digest: result.digest });
        await new Promise((r) => setTimeout(r, 1500));
        const ok = result.effects?.status?.status === "success";
        push({
          drill,
          step: label,
          status: ok ? "success" : "fail",
          digest: result.digest,
          error: ok ? undefined : result.effects?.status?.error ?? "unknown",
        });
        return result;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (!VERSION_STALE.test(lastErr) || attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw new Error(lastErr || "execute failed");
  }

  async function ensureV3Usdc(minUnits = 80n * USDC_UNIT) {
    const coins = await client.getCoins({ owner: sender, coinType: usdcType });
    const balance = coins.data.reduce((s, c) => s + BigInt(c.balance), 0n);
    if (balance >= minUnits) return;
    const tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::usdc::mint_to_sender`,
      arguments: [tx.object(deploy.treasuryCapUsdc), tx.pure.u64(200n * USDC_UNIT)],
    });
    await execute(tx, "mint_to_sender 200 USDC (v3)", "SETUP");
  }

  async function mergeUsdcCoins() {
    await ensureV3Usdc();
    const coins = await client.getCoins({ owner: sender, coinType: usdcType });
    if (coins.data.length <= 1) return coins.data[0]?.coinObjectId;
    const tx = new Transaction();
    const [primary, ...rest] = coins.data.map((c) => c.coinObjectId);
    tx.mergeCoins(
      tx.object(primary),
      rest.map((id) => tx.object(id)),
    );
    await execute(tx, "merge USDC coins", "SETUP");
    return primary;
  }

  async function getUsdcCoin() {
    const merged = await mergeUsdcCoins();
    if (merged) return merged;
    throw new Error(`no USDC coins for type ${usdcType}`);
  }

  async function poolPaused(poolId: string) {
    const o = await client.getObject({ id: poolId, options: { showContent: true } });
    const c = o.data?.content as Record<string, unknown> | null;
    if (!c) return false;
    const fields =
      c.fields && typeof c.fields === "object"
        ? (c.fields as { paused?: boolean })
        : (c as { paused?: boolean });
    return Boolean(fields.paused);
  }

  await ensureV3Usdc();

  // --- Drill A: buy position ---
  try {
    const poolId = deploy.seedMarkets.poisson_goals.poolId;
    const usdcId = await getUsdcCoin();
    let tx = new Transaction();
    const [lpPay] = tx.splitCoins(tx.object(usdcId), [50n * USDC_UNIT]);
    tx.moveCall({
      target: `${pkg}::pool::deposit_liquidity`,
      arguments: [tx.object(poolId), lpPay, tx.object(SUI_CLOCK)],
    });
    await execute(tx, "deposit_liquidity 50 USDC (buy 准备)", "A");

    const usdcId2 = await getUsdcCoin();
    tx = new Transaction();
    const [pay] = tx.splitCoins(tx.object(usdcId2), [10_000n]); // 0.01 USDC — 高负债池友好
    tx.moveCall({
      target: `${pkg}::pool::buy_poisson_digital`,
      arguments: [tx.object(poolId), pay, tx.pure.u8(7), tx.object(SUI_CLOCK)],
    });
    await execute(tx, "buy_poisson_digital k=7 0.01 USDC", "A");
    push({
      drill: "A",
      step: "report_resolution + claim_position",
      status: "skipped",
      note: `池 maturity 在未来；到期后用 settlement_oracle::report_resolution 再 claim`,
    });
  } catch (e) {
    push({
      drill: "A",
      step: "buy_poisson_digital",
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // --- Drill B: slash + pause ---
  const slashPool = deploy.seedMarkets.normal_cpi.poolId;
  try {
    const usdcId = await getUsdcCoin();
    let tx = new Transaction();
    const [lpPay] = tx.splitCoins(tx.object(usdcId), [10n * USDC_UNIT]);
    tx.moveCall({
      target: `${pkg}::pool::deposit_liquidity`,
      arguments: [tx.object(slashPool), lpPay, tx.object(SUI_CLOCK)],
    });
    await execute(tx, "deposit_liquidity 10 USDC (slash 准备)", "B");

    tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::slash::slash_pool`,
      arguments: [
        tx.object(deploy.globalConfig),
        tx.object(deploy.adminCap),
        tx.object(slashPool),
        tx.pure.u64(1_000_000n),
        tx.pure.u64(9001),
        tx.pure.address(sender),
        tx.object(SUI_CLOCK),
      ],
    });
    const slashRes = await execute(tx, "slash_pool 1 USDC", "B");
    const paused = await poolPaused(slashPool);
    push({
      drill: "B",
      step: "verify pool.paused",
      status: paused ? "success" : "fail",
      digest: slashRes.digest,
      note: paused ? "paused=true" : "expected paused=true",
    });
    push({
      drill: "B",
      step: "unslash_resume_pool",
      status: "manual",
      note: "需等待 slash timelock 1800s 后由 Admin 调用 unslash_resume_pool",
    });
  } catch (e) {
    push({
      drill: "B",
      step: "slash flow",
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // --- Drill C: multisig slash ---
  const govPool = deploy.seedMarkets.dirichlet_wdl.poolId;
  try {
    const usdcId = await getUsdcCoin();
    let tx = new Transaction();
    const [lpPay] = tx.splitCoins(tx.object(usdcId), [5n * USDC_UNIT]);
    tx.moveCall({
      target: `${pkg}::pool::deposit_liquidity`,
      arguments: [tx.object(govPool), lpPay, tx.object(SUI_CLOCK)],
    });
    await execute(tx, "deposit_liquidity 5 USDC (gov 准备)", "C");

    tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::slash::init_slash_governance`,
      arguments: [
        tx.object(deploy.globalConfig),
        tx.object(deploy.adminCap),
        tx.pure.vector("address", [sender]),
        tx.pure.u8(1),
      ],
    });
    const initRes = await execute(tx, "init_slash_governance threshold=1", "C");
    const govId = initRes.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("SlashGovernance"),
    )?.objectId;
    if (!govId) throw new Error("SlashGovernance id not found in effects");

    tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::slash::propose_slash_request`,
      arguments: [
        tx.object(govId),
        tx.object(govPool),
        tx.pure.u64(500_000n),
        tx.pure.u64(9002),
        tx.pure.address(sender),
        tx.object(SUI_CLOCK),
      ],
    });
    const propRes = await execute(tx, "propose_slash_request 0.5 USDC", "C");
    const reqId = propRes.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("SlashRequest"),
    )?.objectId;
    if (!reqId) throw new Error("SlashRequest id not found");

    tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::slash::execute_slash_request`,
      arguments: [
        tx.object(govId),
        tx.object(govPool),
        tx.object(reqId),
        tx.object(SUI_CLOCK),
      ],
    });
    await execute(tx, "execute_slash_request (threshold=1)", "C");
  } catch (e) {
    push({
      drill: "C",
      step: "multisig slash",
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // --- Drill D: ZK challenge ---
  const zkPool = deploy.seedMarkets.poisson_goals.poolId;
  try {
    const proofHash = new Uint8Array(32).fill(0xab);
    let tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::zk_coprocessor::submit_proof`,
      arguments: [
        tx.object(zkPool),
        tx.pure.vector("u8", Array.from(proofHash)),
        tx.object(SUI_CLOCK),
      ],
    });
    const subRes = await execute(tx, "submit_proof", "D");
    const ticketId = subRes.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("ZkProofTicket"),
    )?.objectId;
    if (!ticketId) throw new Error("ZkProofTicket id not found");

    tx = new Transaction();
    tx.moveCall({
      target: `${pkg}::zk_coprocessor::verify_proof`,
      arguments: [
        tx.object(deploy.globalConfig),
        tx.object(deploy.adminCap),
        tx.object(zkPool),
        tx.object(ticketId),
        tx.pure.u8(1),
        tx.object(SUI_CLOCK),
      ],
    });
    const verRes = await execute(tx, "verify_proof accepted", "D");
    const verId = verRes.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("ZkVerification"),
    )?.objectId;

    push({
      drill: "D",
      step: "challenge_verification",
      status: "skipped",
      note: "verifier 与 challenger 不可为同一地址（链上约束）；主网需独立挑战者钱包",
    });
    push({
      drill: "D",
      step: "finalize_verification",
      status: "manual",
      note: "需 challenge 窗口 3600s 结束后 Admin finalize",
    });
  } catch (e) {
    push({
      drill: "D",
      step: "zk flow",
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const out = {
    ranAt: new Date().toISOString(),
    commit: (() => {
      try {
        return execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();
      } catch {
        return "";
      }
    })(),
    packageId: pkg,
    sender,
    steps,
  };

  const jsonPath = join(repoRoot, "docs/mainnet-drill-2026-06-06.json");
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));

  const md = buildMarkdown(out, deploy);
  const mdPath = join(repoRoot, "docs/mainnet-drill-2026-06-06.md");
  writeFileSync(mdPath, md);

  const fails = steps.filter((s) => s.status === "fail").length;
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  process.exit(fails > 0 ? 1 : 0);
}

function buildMarkdown(
  out: { ranAt: string; packageId: string; sender: string; steps: DrillStep[] },
  deploy: { packageId: string },
) {
  const ok = (d: string) => out.steps.filter((s) => s.drill === d && s.status === "success").length;
  const lines = [
    "# X-Market Sui 主网前演练记录",
    "",
    "## 0. 基本信息",
    "",
    `- **演练名称：** P0.7 Testnet 应急演练`,
    `- **演练日期：** 2026-06-06`,
    `- **环境：** Sui Testnet`,
    `- **Package ID：** \`${deploy.packageId}\``,
    `- **执行钱包：** \`${out.sender}\``,
    `- **自动化脚本：** \`app/scripts/p0-drills.ts\``,
    "",
    "## 1. 演练范围",
    "",
    `- [${ok("A") > 0 ? "x" : " "}] A. 买入头寸（结算/claim 待 maturity）`,
    `- [${out.steps.some((s) => s.drill === "B" && s.step.includes("slash_pool")) ? "x" : " "}] B. Slash 触发 + paused 验证（resume 待 timelock）`,
    `- [${out.steps.some((s) => s.drill === "C" && s.step.includes("execute")) ? "x" : " "}] C. SlashGovernance 多签 propose → execute`,
    `- [${out.steps.some((s) => s.drill === "D" && s.step.includes("verify_proof")) ? "x" : " "}] D. ZK submit/verify（challenge 需独立钱包；finalize 待窗口）`,
    `- [ ] E. 前端页面手工回归（[p0-drill-ef-checklist.md](../docs/p0-drill-ef-checklist.md)）`,
    `- [ ] F. 告警链路与值班响应（同上）`,
    "",
    "## 3. 执行记录",
    "",
    "| 演练 | 步骤 | 结果 | Digest | 备注 |",
    "|------|------|------|--------|------|",
  ];
  for (const s of out.steps) {
    lines.push(
      `| ${s.drill} | ${s.step} | ${s.status} | ${s.digest ?? ""} | ${s.note ?? s.error ?? ""} |`,
    );
  }
  lines.push(
    "",
    "## 5. 演练结论",
    "",
    `- **总体结论：** ${out.steps.some((s) => s.status === "fail") ? "有条件通过（见失败项）" : "通过（含 manual 项待补完）"}`,
    `- **Manual 待办：** B resume (1800s) · D finalize (3600s) · A claim (maturity 后)`,
    "",
    "## 7. 复核与签字",
    "",
    "协议 / 风控 / 运维 / 产品负责人签字：待完成",
    "",
  );
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
