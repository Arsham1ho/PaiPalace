/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_STAKING_CONTRACT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
