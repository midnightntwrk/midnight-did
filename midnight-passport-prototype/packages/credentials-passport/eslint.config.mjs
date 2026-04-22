import js from '@eslint/js';
import plugin from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginImport from 'eslint-plugin-import';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  {
    ignores: ['./node_modules/**', './dist/**', './build/**', './src/managed/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
    },
    plugins: {
      '@typescript-eslint': plugin,
      prettier: pluginPrettier,
      import: pluginImport,
      'simple-import-sort': pluginSimpleImportSort,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      'import/no-unused-modules': [1, { unusedExports: true }],
      'no-duplicate-imports': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            '@midnight-ntwrk/midnight-did-domain',
            '@midnight-ntwrk/midnight-did',
            '@midnight-ntwrk/midnight-did-api',
          ],
        },
      ],
    }
  }
];
