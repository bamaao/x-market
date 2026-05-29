import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { NETWORK } from "./markets";

export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });
