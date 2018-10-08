module.exports = {
  env: {
    browser: true,
    commonjs: true,
    node: true,
    jasmine: true
  },
  plugins: ['import', 'promise', 'compat', 'node', 'jasmine'],
  extends: ['eslint:recommended', 'plugin:promise/recommended'],
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
    ecmaVestion: 7,
    allowImportExportEverywhere: true
  },
  rules: {
    'promise/always-return': 0,
    'compat/compat': 1,
    'node/no-deprecated-api': 2,
    'node/no-extraneous-require': 2,
    'node/no-missing-require': 2,
    'import/no-unresolved': [2, { commonjs: true, amd: true }],
    'import/named': 2,
    'import/namespace': 2,
    'import/default': 2,
    'import/export': 2,
    indent: ['error', 2],
    'linebreak-style': 0,
    semi: ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': 0
  }
};
