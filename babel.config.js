module.exports = {
  presets: ['@babel/preset-env'],
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        corejs: false,
        helpers: true,
        regenerator: true,
        useESModules: false,
      },
    ],
    ['@babel/plugin-transform-logical-assignment-operators'], // <-- needed for ||= and ??=
    ['module-resolver', { root: './src' }],
  ],
  ignore: ['**/*.test.js', '**/*.spec.js', 'src/test/**'],
};
