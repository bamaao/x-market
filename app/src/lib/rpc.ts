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

/**
 * Loose RPC surface for @mysten/dapp-kit `useSuiClient()`.
 * Uses `any` to avoid duplicate @mysten/sui Transaction type conflicts between dapp-kit and app.
 */
export type XMarketRpc = {
  getObject: (input: any) => Promise<any>;
  devInspectTransactionBlock: (input: any) => Promise<any>;
  queryObjects?: (input: any) => Promise<any>;
  queryEvents?: (input: any) => Promise<any>;
  getCoins?: (input: any) => Promise<any>;
  getTransactionBlock?: (input: any) => Promise<any>;
  waitForTransaction?: (input: any) => Promise<any>;
  executeTransactionBlock?: (input: any) => Promise<any>;
  getDynamicFieldObject?: (input: any) => Promise<any>;
};
