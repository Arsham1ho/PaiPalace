/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_USDC_MINT?: string;
  readonly VITE_TREASURY_ADDRESS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
