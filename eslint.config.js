import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default ts.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '.vitest/',
      'eslint.config.js',
      'vite.config.ts',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: true,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['src/engine/**/*.ts', 'src/methods/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['svelte', 'svelte/*', 'svelte/*/*'],
              message: 'engine and methods are pure TypeScript and must not import Svelte.',
            },
            {
              group: ['**/*.svelte'],
              message:
                'engine and methods are pure TypeScript and must not import Svelte components.',
            },
            {
              group: ['**/ui', '**/ui/**'],
              message: 'engine and methods must not import from src/ui.',
            },
          ],
        },
      ],
    },
  },
)
