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

export interface AuditKeeperConfig {
  rpcUrl: string;
  packageId: string;
  registryId: string;
  poolIds: string[];
  pollMs: number;
  dryRun: boolean;
  healthPort: number;
  secretKey: string;
  indexerUrl: string;
  ipfsGatewayUrl: string;
  sealThreshold: number;
}

export interface ProphecySnapshot {
  id: string;
  prophet: string;
  marketId: string;
  blobId: string;
  sealIdHex: string;
  plaintextHashHex: string;
  predictedValue: number;
  unlockPrice: bigint;
  lockTime: number;
  status: number;
  isPublic: boolean;
}

export interface PoolSnapshot {
  poolId: string;
  resolved: boolean;
  resolvedValue: number | null;
}
