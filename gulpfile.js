'use strict';

var gulp = require('gulp'),
    $ = require('gulp-load-plugins')(),
    babel = require('babel-core/register'),
    isparta = require('isparta'),
    files = './src/**/*.js';

gulp.task('clean', function () {
  require('del').sync('lib');
});

gulp.task('instrument', function(cb) {
  gulp.src(files)
    .pipe($.istanbul({
      instrumenter: isparta.Instrumenter,
      includeUntested: true
    }))
    .pipe($.istanbul.hookRequire())
    .on('finish', cb)
})

gulp.task('cover', ['instrument'], function() {
  return gulp.src('./test/**/*.spec.js', { read: false })
    .pipe($.mocha())
    .pipe($.istanbul.writeReports({
      dir: './coverage',
      reportOpts: { dir: './coverage' },
      reporters: ['html']
    }));
});

gulp.task('test', function() {
  return gulp.src('./test/**/*.spec.js', { read: false })
    .pipe($.mocha());
});

gulp.task('lint', function () {
  return gulp.src(files)
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError());
});

gulp.task('babel', function() {
  return gulp.src(files)
    .pipe($.babel())
    .pipe(gulp.dest('lib'));
});

gulp.task('watch', function() {
  gulp.watch(files + '.js', ['babel']);
});

gulp.task('default', [
  'lint',
  'clean',
  'babel',
  'watch'
]);
