import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc";
import { NETWORK } from "./markets";

const network = NETWORK === "mainnet" ? "mainnet" : "testnet";

export const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl(network),
  network,
});
