const gulp          = require('gulp');
const babel         = require('rollup-plugin-babel');
const concat        = require('gulp-concat');
const rename        = require('gulp-rename');
const uglify        = require('gulp-uglify');
const rollup        = require('rollup');
const commonjs      = require('rollup-plugin-commonjs');
const nodeResolve   = require('rollup-plugin-node-resolve');

// Concatenate & Minify src and dependencies
gulp.task('scripts', function() {

	return rollup.rollup({
		input: './src/js/L.ParticlesLayer.js',
		output: {
			format: 'umd',
			name: 'leaflet-particles'
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
			file: './dist/leaflet-particles.js',
			format: 'umd',
			name: 'leaflet-particles',
			sourcemap: true
		});
	});

});

// bundles npm dependencies into standalone dist file
gulp.task('bundle', function() {

	return rollup.rollup({
			input: './src/js/L.ParticlesLayer.js',
			output: {
				format: 'umd',
				name: 'leaflet-particles-standalone'
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
				file: './dist/leaflet-particles-standalone.js',
				format: 'umd',
				name: 'leaflet-particles',
				sourcemap: true
			});
		});
});

// Watch Files For Changes
gulp.task('watch', function(done) {
	gulp.watch('src/js/*.js', gulp.series('scripts', 'bundle'));
	done();
});

// Default Task
gulp.task('default', gulp.series('scripts', 'bundle', 'watch'));