import type { Monaco } from "@monaco-editor/react";

/** Bump when stub/compiler options change so HMR re-applies config. */
const CONFIG_VERSION = 2;
let configuredVersion = 0;

/**
 * Minimal React + JSX ambient types for Monaco's in-browser TS worker.
 * Without these, `jsx: react-jsx` yields TS2875 (react/jsx-runtime missing).
 */
export const MONACO_REACT_JSX_STUB = `
declare namespace React {
  type ReactNode = any;
  type Key = string | number;
  type FC<P = Record<string, unknown>> = (props: P & { children?: ReactNode }) => ReactNode;
  type ComponentType<P = Record<string, unknown>> = FC<P>;
  interface RefObject<T> { readonly current: T | null; }
  interface MutableRefObject<T> { current: T; }
  function createElement(type: any, props?: any, ...children: any[]): any;
  function useState<S>(initial: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useLayoutEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly any[]): T;
  function useRef<T>(initial: T): MutableRefObject<T>;
  function useRef<T>(initial: T | null): RefObject<T>;
  function useContext<T>(context: any): T;
  const Fragment: any;
  const StrictMode: any;
}
declare module "react" {
  export = React;
  export as namespace React;
}
declare module "react/jsx-runtime" {
  export function jsx(type: any, props: any, key?: React.Key): any;
  export function jsxs(type: any, props: any, key?: React.Key): any;
  export function jsxDEV(type: any, props: any, key?: React.Key): any;
  export const Fragment: any;
}
declare module "react/jsx-dev-runtime" {
  export function jsx(type: any, props: any, key?: React.Key): any;
  export function jsxs(type: any, props: any, key?: React.Key): any;
  export function jsxDEV(type: any, props: any, key?: React.Key): any;
  export const Fragment: any;
}
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  type Element = any;
  type ElementClass = any;
  interface ElementAttributesProperty { props: any; }
  interface ElementChildrenAttribute { children: any; }
}
`;

const JSX_RUNTIME_STUB = `
declare module "react/jsx-runtime" {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export function jsxDEV(type: any, props: any, key?: any): any;
  export const Fragment: any;
}
`;

/** Configure Monaco built-in TS/JS so `.tsx` JSX works without project node_modules. */
export function configureMonacoTsDefaults(monaco: Monaco): void {
  if (configuredVersion === CONFIG_VERSION) return;
  configuredVersion = CONFIG_VERSION;

  const compilerOptions = {
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    lib: ["es2022", "dom"],
    baseUrl: ".",
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // Ambient React + explicit jsx-runtime paths (TS2875 looks up these module IDs).
  const libs: Array<[string, string]> = [
    [MONACO_REACT_JSX_STUB, "file:///node_modules/@types/react/index.d.ts"],
    [JSX_RUNTIME_STUB, "file:///node_modules/react/jsx-runtime.d.ts"],
    [JSX_RUNTIME_STUB, "file:///node_modules/react/jsx-dev-runtime.d.ts"],
    [JSX_RUNTIME_STUB, "file:///node_modules/@types/react/jsx-runtime.d.ts"],
  ];
  for (const [source, path] of libs) {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(source, path);
    monaco.languages.typescript.javascriptDefaults.addExtraLib(source, path);
  }

  // Keep syntax checks; ignore missing third-party packages we do not vend into Monaco.
  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [
      2307, // Cannot find module '…'
      2792, // Cannot find module (node resolution variant)
    ],
  };
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
}

/** Test helper — reset the once-flag between unit tests if needed. */
export function resetMonacoTsDefaultsForTests(): void {
  configuredVersion = 0;
}
