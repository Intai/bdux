/* eslint-env node */

var gulp = require('gulp'),
    $ = require('gulp-load-plugins')(),
    spawn = require('child_process').spawn,
    srcFiles = './src/**/!(*.spec|*.config).js',
    testFiles = './src/**/*.spec.js';

function clean(cb) {
  require('del').sync('lib');
  cb();
}

gulp.task('cover', function(cb) {
  var cmd = spawn('node', [
    'node_modules/nyc/bin/nyc.js',
    'node_modules/mocha/bin/mocha',
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
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError());
}

function babel() {
  return gulp.src(srcFiles)
    .pipe($.babel())
    .pipe(gulp.dest('lib'));
}

function watch() {
  gulp.watch([srcFiles, testFiles], test);
}

gulp.task('test', test);

gulp.task('lint', lint);

gulp.task('build', gulp.series(
  clean,
  babel
));

gulp.task('default', gulp.series(
  lint,
  test,
  watch
));
