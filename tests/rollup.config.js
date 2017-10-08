export default {
  input: 'tests/simple-test.js',
  external: ['ava'],

  output: {
    file: 'build/simple-test.js',
    format: 'cjs',
    sourcemap: true
  }
};
