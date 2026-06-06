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
  getDynamicFieldObject?: (input: any) => Promise<any>;
};
