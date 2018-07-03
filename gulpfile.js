const gulp          = require('gulp');
const babel         = require('gulp-babel');
const concat        = require('gulp-concat');
const concatCss     = require('gulp-concat-css');
const rename        = require('gulp-rename');
const uglify        = require('gulp-uglify');
const cssNano       = require('gulp-cssnano');

// Concatenate & Minify src and dependencies
gulp.task('scripts', function(done) {
	gulp.src([
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
	done();
});

gulp.task('concatCss', function (done) {
	gulp.src('./src/css/L.ParticleDispersionLayer.css')
		.pipe(concatCss('leaflet-particle-dispersion.css'))
		.pipe(gulp.dest('./dist'));
	done();
});

gulp.task('cssNano', gulp.series('concatCss', function(done) {
	gulp.src('./dist/leaflet-particle-dispersion.css')
		.pipe(cssNano())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('./dist'));
	done();
}));

// Watch Files For Changes
gulp.task('watch', function(done) {
	// We watch both JS and HTML files.
	gulp.watch('src/js/*.js', gulp.series('scripts'));
	gulp.watch('src/css/*.css', gulp.series('concatCss', 'cssNano'));
	done();
});

// Default Task
gulp.task('default', gulp.series('scripts', 'concatCss', 'cssNano', 'watch'));