import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Chrome extension API
        chrome: "readonly",
        // Standard browser globals
        console: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        globalThis: "readonly",
        self: "readonly",
        top: "readonly",
        parent: "readonly",
        // Storage
        indexedDB: "readonly",
        IDBKeyRange: "readonly",
        IDBDatabase: "readonly",
        IDBObjectStore: "readonly",
        IDBRequest: "readonly",
        IDBTransactionMode: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        // Timers + animation
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        // DOM element types used in the codebase
        Element: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        HTMLElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLSourceElement: "readonly",
        HTMLUListElement: "readonly",
        HTMLVideoElement: "readonly",
        // Events
        Event: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        CustomEvent: "readonly",
        // Observers
        MutationObserver: "readonly",
        // Network + data
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        // Encoding
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
        btoa: "readonly",
        atob: "readonly",
        // Dialogs
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
