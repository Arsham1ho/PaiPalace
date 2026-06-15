import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// ⚠️ Defaults to a TESTNET. Never point this at mainnet without an audit + license.
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    // Mainnet intentionally omitted — add only after audit + legal sign-off.
  },
};

export default config;
