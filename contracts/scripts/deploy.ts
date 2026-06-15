import { ethers } from "hardhat";

// Deploys PaiPalaceStaking to the configured TESTNET.
// Usage: DEPLOYER_PRIVATE_KEY=0x... TOKEN_ADDRESS=0x... SETTLER=0x... \
//        pnpm --filter @paipalace/contracts deploy:testnet
async function main() {
  const token = process.env.TOKEN_ADDRESS;
  const settler = process.env.SETTLER ?? (await ethers.getSigners())[0].address;
  if (!token) throw new Error("Set TOKEN_ADDRESS to the testnet ERC-20 (e.g. test USDC) address");

  const Staking = await ethers.getContractFactory("PaiPalaceStaking");
  const staking = await Staking.deploy(token, settler);
  await staking.waitForDeployment();

  console.log("PaiPalaceStaking deployed to:", await staking.getAddress());
  console.log("Settler:", settler);
  console.log("\nSet client/.env → VITE_STAKING_CONTRACT to the address above.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
