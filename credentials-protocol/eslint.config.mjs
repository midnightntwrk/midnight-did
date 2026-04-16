import js from "@eslint/js";
import plugin from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import pluginImport from "eslint-plugin-import";
import pluginSimpleImportSort from "eslint-plugin-simple-import-sort";

export default [
  {
    ignores: ["./node_modules/**", "./dist/**", "./build/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": plugin,
      import: pluginImport,
      "simple-import-sort": pluginSimpleImportSort,
    },
    rules: {
      "no-unused-vars": "off",
      "import/no-unused-modules": [1, { unusedExports: true }],
      "no-duplicate-imports": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
];
