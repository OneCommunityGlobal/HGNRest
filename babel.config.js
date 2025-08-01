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
    ['module-resolver', { root: './src' }],
  ],
  ignore: ['**/*.test.js', '**/*.spec.js', 'src/test/**'],
};
