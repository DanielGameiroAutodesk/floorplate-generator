module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  ignorePatterns: [
    'dist/',
    'dist-extension/',
    'node_modules/',
    '*.js', // Ignore JS files in root (config files)
  ],
  rules: {
    // Align with tsconfig strict settings
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // Allow console for now (debug logs exist in codebase)
    'no-console': 'off',
  },
};
