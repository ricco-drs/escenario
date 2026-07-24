import globals from 'globals';

/**
 * Configuración mínima, orientada a un solo objetivo: cazar los errores que
 * sólo se ven al ejecutar. `no-undef` habría detectado la constante `R`
 * usada sin importar, que dejaba la página colgada en la pantalla de carga.
 */
export default [
  {
    files: ['src/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': 'warn',
    },
  },
];
