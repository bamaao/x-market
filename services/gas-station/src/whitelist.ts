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

/** MVP sponsor whitelist (PRD §11.3.6). */

import { fromBase64 } from "@mysten/sui/utils";

export interface WhitelistRule {
  module: string;
  function: string;
  /** If set, only allow when a pure u64 input matches one of these values (commit unlock_price). */
  pureU64ArgIndex?: number;
  pureU64Equals?: bigint;
  pureU64Allowed?: bigint[];
}

const PACKAGE = process.env.PACKAGE_ID ?? "";

export const DEFAULT_WHITELIST: WhitelistRule[] = [
  {
    module: "prophet_registry",
    function: "commit_private_prophecy",
    pureU64ArgIndex: 6,
    pureU64Allowed: [0n],
  },
  { module: "prophet_registry", function: "unlock_prophecy" },
  { module: "prophet_registry", function: "audit_prophecy" },
  { module: "pool", function: "buy_poisson_interval" },
  { module: "pool", function: "buy_dirichlet_outcome" },
  { module: "pool", function: "buy_normal_digital" },
  { module: "pool", function: "buy_normal_interval" },
];

type ArgRef =
  | { GasCoin: true }
  | { Input: number }
  | { Result: number }
  | { NestedResult: [number, number] };

type TxInput =
  | { Pure: { bytes: string } }
  | Record<string, unknown>;

type MoveCallCmd = {
  MoveCall: {
    package: string;
    module: string;
    function: string;
    arguments: ArgRef[];
  };
};

function readPureU64(inputs: TxInput[], arg: ArgRef): bigint | null {
  if (!("Input" in arg)) return null;
  const input = inputs[arg.Input];
  if (!input || !("Pure" in input)) return null;
  const pure = input.Pure as { bytes: string };
  const bytes = fromBase64(pure.bytes);
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, true);
}

export function validateTransactionData(
  data: {
    commands: Array<Record<string, unknown>>;
    inputs: TxInput[];
  },
  rules: WhitelistRule[] = DEFAULT_WHITELIST,
): { ok: true } | { ok: false; reason: string } {
  if (!data.commands.length) {
    return { ok: false, reason: "empty transaction" };
  }
  for (const cmd of data.commands) {
    if (!("MoveCall" in cmd)) {
      return { ok: false, reason: "only MoveCall commands are allowed" };
    }
    const mc = (cmd as MoveCallCmd).MoveCall;
    if (PACKAGE && mc.package !== PACKAGE) {
      return { ok: false, reason: `package mismatch: ${mc.package}` };
    }
    const rule = rules.find(
      (r) => r.module === mc.module && r.function === mc.function,
    );
    if (!rule) {
      return {
        ok: false,
        reason: `move call not whitelisted: ${mc.module}::${mc.function}`,
      };
    }
    if (rule.pureU64ArgIndex !== undefined) {
      const arg = mc.arguments[rule.pureU64ArgIndex];
      if (!arg) {
        return { ok: false, reason: "missing pure u64 argument" };
      }
      const value = readPureU64(data.inputs, arg);
      const allowed =
        rule.pureU64Allowed ??
        (rule.pureU64Equals !== undefined ? [rule.pureU64Equals] : null);
      if (allowed && !allowed.includes(value ?? -1n)) {
        return {
          ok: false,
          reason: `unlock_price ${value} not allowed for sponsored commit`,
        };
      }
    }
  }
  return { ok: true };
}
