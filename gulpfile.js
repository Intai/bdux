/* eslint-env node */

var gulp = require('gulp'),
    gulpBabel = require('gulp-babel'),
    gulpEslint = require('gulp-eslint'),
    spawn = require('child_process').spawn,
    srcFiles = './src/**/!(*.spec|*.config).js',
    testFiles = './src/**/*.spec.js';

function clean(cb) {
  require('del').sync('lib');
  cb();
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
