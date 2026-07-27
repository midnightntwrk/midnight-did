// This file is part of midnightntwrk/midnight-did.
// SPDX-License-Identifier: Apache-2.0

import js from '@eslint/js';
import plugin from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import pluginImport from 'eslint-plugin-import';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

export default [
  {
    ignores: ['**/*.d.ts', '**/*.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'src/managed/**'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.examples.json'],
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
      import: pluginImport,
      'simple-import-sort': pluginSimpleImportSort,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-unused-modules': [1, { unusedExports: true }],
      'no-duplicate-imports': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
];
