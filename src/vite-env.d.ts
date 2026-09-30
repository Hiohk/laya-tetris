/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LAYA_ENDPOINT?: string
  readonly VITE_LAYA_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
