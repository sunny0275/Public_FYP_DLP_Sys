/// <reference types="vite/client" />

declare module 'pako' {
  export function deflate(data: Uint8Array | number[]): Uint8Array;
  export function inflate(data: Uint8Array | number[]): Uint8Array;
  export function deflateRaw(data: Uint8Array | number[]): Uint8Array;
  export function inflateRaw(data: Uint8Array | number[]): Uint8Array;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
