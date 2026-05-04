import type { HardhatUserConfig } from "hardhat/config";

// Pinned to 2.20.1 (last release before @nomicfoundation/edr). Newer 2.x still loads EDR and can fail on Windows with ERR_DLOPEN_FAILED.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
  },
};

export default config;
