const gulp          = require('gulp');
const babel         = require('rollup-plugin-babel');
const concat        = require('gulp-concat');
const concatCss     = require('gulp-concat-css');
const rename        = require('gulp-rename');
const uglify        = require('gulp-uglify');
const cssNano       = require('gulp-cssnano');
const rollup        = require('rollup');
const commonjs      = require('rollup-plugin-commonjs');
const nodeResolve   = require('rollup-plugin-node-resolve');

// Concatenate & Minify src and dependencies
gulp.task('scripts', function() {

	return rollup.rollup({
		input: './src/js/L.ParticleDispersionLayer.js',
		output: {
			format: 'umd',
			name: 'leaflet-particle-dispersion'
		},
		plugins: [
			babel({
				exclude: 'node_modules/**' // only transpile our source code
			}),
			commonjs({
				include:
					'node_modules/**'
			})
		],
		// indicate which modules should be treated as external
		// i.e. don't package these with our exported module
		external: [
			'chroma-js',
			'leaflet-heatbin'
		]
	})

	// and output to ./dist/app.js as normal.
	.then(bundle => {
		return bundle.write({
			file: './dist/leaflet-particle-dispersion.js',
			format: 'umd',
			name: 'leaflet-particle-dispersion',
			sourcemap: true
		});
	});

});

// bundles npm dependencies into standalone dist file
gulp.task('bundle', function() {

	return rollup.rollup({
			input: './src/js/L.ParticleDispersionLayer.js',
			output: {
				format: 'umd',
				name: 'leaflet-particle-dispersion-standalone'
			},
			plugins: [
				babel({
					exclude: 'node_modules/**' // only transpile our source code
				}),
				nodeResolve({
					// pass custom options to the resolve plugin
					customResolveOptions: {
						moduleDirectory: 'node_modules'
					},
					jsnext: true,
					module: true,
					main: true,  // for commonjs modules that have an index.js
					browser: true
				}),
				commonjs({
					include: 'node_modules/**'
				})
			]
		})

		// and output to ./dist/app.js as normal.
		.then(bundle => {
			return bundle.write({
				file: './dist/leaflet-particle-dispersion-standalone.js',
				format: 'umd',
				name: 'leaflet-particle-dispersion',
				sourcemap: true
			});
		});
});

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