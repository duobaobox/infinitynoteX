module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', 'dist-electron', 'release', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // 暂时放宽，避免阻塞开发；后续可提升为 'error'
    '@typescript-eslint/no-explicit-any': 'warn',
    // 避免个别空块导致报错，catch 允许空
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
};
