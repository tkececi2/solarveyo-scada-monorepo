/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react-dom/client' {
  import * as React from 'react';
  
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  
  export interface RootOptions {
    onRecoverableError?: (error: Error) => void;
    identifierPrefix?: string;
  }
  
  export function createRoot(
    container: Element | Document | DocumentFragment | Comment,
    options?: RootOptions
  ): Root;
  
  export function hydrateRoot(
    container: Element | Document | Comment,
    initialChildren: React.ReactNode,
    options?: RootOptions
  ): Root;
}
