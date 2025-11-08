module.exports = {
  extends: ['eslint:recommended', 'airbnb-base', 'prettier'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    requireConfigFile: true,
    babelOptions: {
      configFile: `${__dirname}/babel.config.js`,
    },
  },
  env: { es6: true, node: true, commonjs: true },
  rules: {
    // ===============================
    // KEEP EXISTING RELAXED RULES
    // ===============================
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
    'no-console': 'warn',
    'consistent-return': 'off',

    // ===============================
    // LIGHT ENTERPRISE ADDITIONS (MOSTLY WARNINGS)
    // ===============================
    
    // Critical Error Prevention (errors only for breaking stuff)
    'no-undef': 'error',
    'no-unused-vars': ['warn', { 
      vars: 'local', 
      args: 'none',
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    
    // Security (light - just warnings to start awareness)
    'no-eval': 'warn',
    'no-implied-eval': 'warn',
    'no-new-func': 'warn',
    'no-script-url': 'warn',
    
    // Code Quality (warnings only - gradual improvement)
    'no-var': 'warn', // Encourage let/const
    'prefer-const': 'warn', // Encourage immutability
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2, 100, 200, 201, 400, 401, 403, 404, 500],
      ignoreArrayIndexes: true 
    }],
    'prefer-template': 'warn',
    'no-duplicate-imports': 'warn',
    'object-shorthand': 'warn',
    
    // Async/Promise Best Practices (warnings)
    'no-return-await': 'warn',
    'prefer-promise-reject-errors': 'warn',
    'no-async-promise-executor': 'warn',
    
    // Node.js Specific (warnings)
    'no-path-concat': 'warn',
    'no-process-exit': 'warn',
    'handle-callback-err': 'warn',
    'new-cap': 'warn',
    'no-lonely-if': 'warn',
    'no-nested-ternary': 'warn',
    'camelcase': 'warn',
    'radix': 'warn',
    'no-restricted-syntax': 'warn',

    
    // Light Complexity Control (warnings with high thresholds)
    'complexity': ['warn', { max: 15 }], // High threshold for lazy devs
    'max-depth': ['warn', { max: 5 }],
    'max-params': ['warn', { max: 4 }],
    'max-lines-per-function': ['warn', { 
      max: 100, 
      skipBlankLines: true, 
      skipComments: true 
    }],
    
    // Import Organization (warnings only)
    'import/order': ['warn', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'never' // Keep it simple
    }],
    'import/newline-after-import': 'warn',
    'import/no-duplicates': 'warn',
    
    // Performance Hints (warnings)
    'no-loop-func': 'warn',
    
    // API Design (warnings for better practices)
    'no-throw-literal': 'warn',
    'prefer-rest-params': 'warn',
    'prefer-spread': 'warn',
    
    // Database/Backend Specific (warnings)
    'no-eq-null': 'warn', // Encourage strict equality
    'eqeqeq': ['warn', 'smart'], // Allow == null for lazy devs
    
    // Documentation Encouragement (warnings)
    'spaced-comment': ['warn', 'always', { 
      markers: ['/', '!', '*'],
      exceptions: ['-', '+', '*']
    }],
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx'],
      },
    },
  },
  overrides: [
    // Test Files - More Relaxed
    {
      files: ['**/*.test.js', '**/*.spec.js', 'src/test/**/*.js', 'src/__tests__/**/*.js'],
      env: { jest: true },
      rules: {
        // Relax rules for test files
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
        'complexity': 'off',
        'max-params': 'off',
        'prefer-promise-reject-errors': 'off',
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
      }
    },
    
    // Config Files - Super Relaxed
    {
      files: ['*.config.js', '.eslintrc.js', 'babel.config.js', 'webpack.config.js'],
      rules: {
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
        'global-require': 'off',
      }
    },
    
    // Migration Files - Relaxed (if using DB migrations)
    {
      files: ['**/migrations/*.js', '**/seeders/*.js'],
      rules: {
        'no-console': 'off',
        'max-lines-per-function': 'off',
        'no-magic-numbers': 'off',
      }
    }
  ],
};