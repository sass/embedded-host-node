import {defineConfig, globalIgnores} from 'eslint/config';
import tseslint from 'typescript-eslint';
import gts from 'gts';

export default defineConfig([
  globalIgnores([
    '**/build/',
    '**/dist/',
    '**/language/',
    '**/_types/',
    'lib/src/vendor/',
    '**/*.js',
  ]),
  {
    extends: [tseslint.configs.recommended, gts],

    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {allowExpressions: true},
      ],
      'n/no-extraneous-require': ['error', {allowModules: ['sass']}],
      'func-style': ['error', 'declaration'],
      'prefer-const': ['error', {destructuring: 'all'}],
      'sort-imports': ['error', {ignoreDeclarationSort: true}],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
]);
