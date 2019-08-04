/* eslint-env node */

var gulp = require('gulp'),
    gulpBabel = require('gulp-babel'),
    gulpEslint = require('gulp-eslint'),
    del = require('del'),
    spawn = require('child_process').spawn,
    srcFiles = './src/**/!(*.spec|*.config).js',
    testFiles = './src/**/*.spec.js';

function clean() {
  return del(['es', 'lib']);
}

gulp.task('cover', function(cb) {
  var cmd = spawn('node', [
    'node_modules/cross-env/dist/bin/cross-env.js', 'NODE_ENV=test',
    'node_modules/nyc/bin/nyc.js',
    'node_modules/mocha/bin/_mocha',
    '--opts', '.mocha.opts'
  ], {
    stdio: 'inherit'
  });

  cmd.on('close', cb);
});

function test(cb) {
  var cmd = spawn('node', [
    'node_modules/mocha/bin/mocha',
    '--opts', '.mocha.opts'
  ], {
    stdio: 'inherit'
  });

  cmd.on('close', cb);
}

function lint() {
  return gulp.src(srcFiles)
    .pipe(gulpEslint())
    .pipe(gulpEslint.format())
    .pipe(gulpEslint.failAfterError());
}

function babel() {
  return gulp.src(srcFiles)
    .pipe(gulpBabel())
    .pipe(gulp.dest('lib'));
}

function babelEs() {
  return gulp.src(srcFiles)
    .pipe(gulpBabel({
      presets: [
        ['@babel/preset-env', { modules: false }],
        '@babel/react'
      ],
      plugins: [
        '@babel/plugin-syntax-object-rest-spread',
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-proposal-class-properties'
      ]
    }))
    .pipe(gulp.dest('es'));
}

function watch() {
  gulp.watch([srcFiles, testFiles], test);
}

gulp.task('test', test);

gulp.task('lint', lint);

gulp.task('build', gulp.series(
  clean,
  babel,
  babelEs
));

gulp.task('default', gulp.series(
  lint,
  test,
  watch
));
