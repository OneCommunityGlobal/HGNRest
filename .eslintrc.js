module.exports = {
  extends: ['eslint:recommended', 'airbnb-base', 'prettier'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    requireConfigFile: true,
    ecmaFeatures: {
      jsx: true,
    },
    babelOptions: {
      configFile: `${__dirname}/babel.config.js`,
    },
  },
  env: { es6: true, node: true, commonjs: true },
  rules: {
    'global-require': 'off',
    'func-names': 'off',
    'no-underscore-dangle': 'off',
    'no-param-reassign': 'off',
    'max-len': 'off',
    'no-continue': 'warn',
    'no-await-in-loop': 'warn',
    'template-curly-spacing': 'off',
    indent: 'off',
    'linebreak-style': 0,
    'no-console': 'off',
    'consistent-return': 'off',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx'],
      },
    },
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', 'src/test/*.js'],
      env: { jest: true },
    },
  ],
};
