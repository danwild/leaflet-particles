const gulp          = require('gulp');
const babel         = require('gulp-babel');
const concat        = require('gulp-concat');
const concatCss     = require('gulp-concat-css');
const rename        = require('gulp-rename');
const uglify        = require('gulp-uglify');
const cssNano       = require('gulp-cssnano');

// Concatenate & Minify src and dependencies
gulp.task('scripts', function(done) {
	return gulp.src([
			'src/js/**.js'
		])
		.pipe(concat('leaflet-particle-dispersion.js'))
		.pipe(babel({
			presets: ['es2015']
		}))
		.pipe(gulp.dest('dist'))
		.pipe(rename('leaflet-particle-dispersion.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('dist'));
});

// bundle deps for standalone dist
gulp.task('bundle', gulp.series('scripts', function(done) {
	return gulp.src([
			'dist/leaflet-particle-dispersion.js',
			'node_modules/chroma-js/chroma.js',
			'node_modules/leaflet.heat/dist/leaflet-heat.js'
		])
		.pipe(concat('leaflet-particle-dispersion-standalone.js'))
		.pipe(gulp.dest('dist'))
		.pipe(rename('leaflet-particle-dispersion-standalone.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('dist'));
}));

gulp.task('concatCss', function () {
	return gulp.src('./src/css/*.css')
		.pipe(concatCss('leaflet-particle-dispersion.css'))
		.pipe(gulp.dest('./dist'));
});

gulp.task('cssNano', function() {
	return gulp.src('dist/leaflet-particle-dispersion.css')
		.pipe(cssNano())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('./dist'));
});

// Watch Files For Changes
gulp.task('watch', function(done) {
	// We watch both JS and HTML files.
	gulp.watch('src/js/*.js', gulp.series('scripts', 'bundle'));
	gulp.watch('src/css/*.css', gulp.series('concatCss', 'cssNano'));
	done();
});

// Default Task
gulp.task('default', gulp.series('scripts', 'bundle', 'concatCss', 'cssNano', 'watch'));