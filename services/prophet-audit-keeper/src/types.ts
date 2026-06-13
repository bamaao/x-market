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
