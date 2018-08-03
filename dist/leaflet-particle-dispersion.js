(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('chroma-js'), require('leaflet-heatbin')) :
	typeof define === 'function' && define.amd ? define(['chroma-js', 'leaflet-heatbin'], factory) :
	(global['leaflet-particle-dispersion'] = factory(global.chroma,global.leafletHeatbin));
}(this, (function (chroma,leafletHeatbin) { 'use strict';

	chroma = chroma && chroma.hasOwnProperty('default') ? chroma['default'] : chroma;
	leafletHeatbin = leafletHeatbin && leafletHeatbin.hasOwnProperty('default') ? leafletHeatbin['default'] : leafletHeatbin;

	const ParticleDispersionLayer = (L.Layer ? L.Layer : L.Class).extend({

		// misc
		_particleLayer: null,
		_frameIndex: 0,
		_markers: [],
		_colors: null,

		/*------------------------------------ LEAFLET SPECIFIC ------------------------------------------*/

		_active: false,
		_map: null,
		// the L.canvas renderer
		_renderer: null,
		// the DOM leaflet-pane that contains html canvas
		_pane: null,

		// user options
		options: {
			data: null,
			dataFormat: {
				idIndex: 0,
				lonIndex: 1,
				latIndex: 2,
				depthIndex: 3,
				ageIndex: 4
			},
			displayMode: '',
			startFrameIndex: 0,
			ageColorScale: null,
			ageDomain: null,
			heatOptions: {
				blur: 1,
				// radius should be small ONLY if scaleRadius is true (or small radius is intended)
				// if scaleRadius is false it will be the constant radius used in pixels
				"radiusMeters": 1000,
				"fixedRadius": false,
				"radius": 20,
				"heatBin": {
					"enabled": false,
					"cellSizeKm": 1
				},
				"maxOpacity": .8,
				// scales the radius based on map zoom
				"scaleRadius": false,
				// if set to false the heatmap uses the global maximum for colorization
				// if activated: uses the data maximum within the current map boundaries
				//   (there will always be a red spot with useLocalExtremas true)
				"useLocalExtrema": false,
				// which field name in your data represents the latitude - default "lat"
				latField: 'lat',
				// which field name in your data represents the longitude - default "lng"
				lngField: 'lng',
				// which field name in your data represents the data value - default "value"
				valueField: 'value'
			},
			exposureIntensity: 1,
			finalIntensity: 1
		},

		initialize: function (options) {
			// (L.setOptions was not working as expected)
			this.options = this._extendObject(this.options, options);
		},

		/**
	  * Initialise renderer when layer is added to the map / becomes active,
	  * and draw circle markers if user has specified the displayMode
	  *
	  * @param map {Object} Leaflet map
	  */
		onAdd: function (map) {
			this._active = true;
			this._map = map;
			this._createRenderer();
			if (this.options.displayMode) this.setDisplayMode(this.options.displayMode);
		},

		/**
	  * Remove the pane from DOM, and void renderer when layer removed from map
	  */
		onRemove() {
			this._map.removeLayer(this._particleLayer);
			L.DomUtil.remove(this._pane);
			this._renderer = null;
			this._particleLayer = null;
			this._active = false;
			if (this.options.onRemove) this.options.onRemove();
		},

		/*------------------------------------ PUBLIC ------------------------------------------*/

		/**
	  * check if the particle layer is currently active on the map
	  * @returns {boolean}
	  */
		isActive() {
			return this._active;
		},

		/**
	  * Update the layer with new data
	  * @param data
	  */
		setData(data) {
			this.options.data = data;
			this.setDisplayMode(this.options.displayMode);
		},

		/**
	  * Set options object, updates layer
	  * @param options
	  */
		setOptions(options) {
			this.options = this._extendObject(this.options, options);
			this.update();
		},

		/**
	  * Trigger layer update/redraw
	  */
		update() {
			this.setDisplayMode(this.options.displayMode);
		},

		/**
	  * Set the display mode of the layer
	  * @param mode {string} One of: ['FINAL', 'EXPOSURE', 'KEYFRAME']
	  */
		setDisplayMode(mode) {

			this.options.displayMode = mode;

			if (!this.isActive()) return;

			switch (this.options.displayMode) {

				case 'EXPOSURE':
					this._initDisplayExposure();
					break;

				case 'FINAL':
					this._initDisplayFinal();
					break;

				case 'KEYFRAME':
					this._initDisplayKeyframe();
					break;

				default:
					console.error(`Attempted to initialise with invalid displayMode: ${this.options.displayMode}`);
					break;
			}
		},

		/**
	  * Returns the current `displayMode`
	  * @returns {string} One of: ['FINAL', 'EXPOSURE', 'KEYFRAME', null]
	  */
		getDisplayMode() {
			return this.options.displayMode;
		},

		/**
	  * Display the particles at the given frame index
	  * @param index {number} the keyframe index
	  */
		setFrameIndex(index) {

			if (!this.isActive()) return;
			const self = this;
			self._frameIndex = index;

			const keys = Object.keys(self.options.data);
			const frame = self.options.data[keys[index]];

			// there's no addLayer*s* function, either need to add each
			// L.circleMarker individually, or reinit the entire layer
			if (self._particleLayer) self._particleLayer.clearLayers();

			for (let i = 0; i < frame.length; i++) {

				const particle = frame[i];
				const pos = self._map.wrapLatLng([particle[self.options.dataFormat.latIndex], particle[self.options.dataFormat.lonIndex]]);
				let marker = L.circleMarker(pos, {
					renderer: self._renderer,
					stroke: false,
					fillOpacity: 0.3,
					radius: 8,
					fillColor: this._colors(particle[self.options.dataFormat.ageIndex]).hex(),
					_feature: particle

				});

				self._markers.push(marker);
				self._particleLayer.addLayer(marker);
			}
		},

		/**
	  * Returns leaflet LatLngBounds of the layer
	  */
		getLatLngBounds() {

			if (!this.options.data || !this._map) return null;

			// get keys, flatten the data
			const snapshots = this._flattened();

			return L.latLngBounds(snapshots.map(s => {
				return this._map.wrapLatLng([s[this.options.dataFormat.latIndex], s[this.options.dataFormat.lonIndex]]);
			}));
		},

		/**
	  * A wrapper function for `L.heatBin.getGridInfo` to get information about the grid used for binning
	  * @returns {*}
	  */
		getGridInfo() {
			if (!this._active || !this._particleLayer || !this._particleLayer.getGridInfo) return null;
			return this._particleLayer.getGridInfo();
		},

		/**
	  * Return readonly particleLayer
	  * @returns {null}
	  */
		getParticleLayer() {
			return this._particleLayer;
		},

		/**
	  * Return an array of unique particle ID's
	  * @returns {Array}
	  */
		getParticleIds() {
			const snapshots = this._flattened();
			// get an array of uniq particles
			let uids = [];
			snapshots.forEach(snapshot => {
				if (uids.indexOf(snapshot[this.options.dataFormat.idIndex]) === -1) uids.push(snapshot[this.options.dataFormat.idIndex]);
			});
			return uids;
		},

		/**
	  * Return the min/max percent range on a heatBin layer with unique ID's
	  * i.e. what is the min/max percent of unique data points that have touched any grid cell
	  * @returns {*}
	  */
		getUniquePercentRange() {
			if (!this._active || !this._particleLayer || !this._particleLayer.getGridInfo) return null;
			const gridInfo = this.getGridInfo();
			const ids = this.getParticleIds();
			if (!gridInfo.hasOwnProperty('maxCellCount')) return null;
			let minPercent = gridInfo.minCellCount / ids.length;
			return {
				min: minPercent >= 0 ? minPercent : 0,
				max: gridInfo.maxCellCount / ids.length * 100
			};
		},

		/*------------------------------------ PRIVATE ------------------------------------------*/

		_flattened() {
			let keys = Object.keys(this.options.data);
			let snapshots = [];
			keys.forEach(key => {
				snapshots = snapshots.concat(this.options.data[key]);
			});
			return snapshots;
		},

		/**
	  * Create the L.canvas renderer and custom pane to display particles
	  * @private
	  */
		_createRenderer() {
			// create separate pane for canvas renderer
			this._pane = this._map.createPane('particle-dispersion');
			this._renderer = L.canvas({ pane: 'particle-dispersion' });
		},

		/**
	  * Remove the particle layer from the map and clear our reference
	  * @private
	  */
		_clearDisplay() {
			if (this._particleLayer) this._map.removeLayer(this._particleLayer);
			this._particleLayer = null;
		},

		/**
	  * @summary Create a chroma-js color scale with user settings or auto scaled to keyframe range
	  * @returns {Object} chromaJs color object
	  * @private
	  */
		_createColors() {
			if (!this.options.ageDomain) this.options.ageDomain = [0, Object.keys(this.options.data).length];
			this._colors = chroma.scale(this.options.ageColorScale).domain(this.options.ageDomain);
			return this._colors;
		},

		/**
	  * Create the display layer (heatmap) for FINAL distribution.
	  * @private
	  */
		_initDisplayFinal() {

			this._clearDisplay();

			if (this.options.data) {

				this._createColors();
				const finalData = this._createFinalData();
				this._particleLayer = L.heatBin(this.options.heatOptions);
				this._particleLayer.addTo(this._map);
				this._particleLayer.setData(finalData);
			}
		},

		/**
	  * Process data into expected leaflet.heat format,
	  * plotting only particles at their end of life
	  * [ [lat, lon, intensity], ... ]
	  * @private
	  */
		_createFinalData() {

			let finalData = [];

			// get keys, moving forward in time
			let keys = Object.keys(this.options.data);
			keys.sort((a, b) => {
				return new Date(a) - new Date(b);
			});

			// flatten the data
			let snapshots = [];
			keys.forEach(key => {
				snapshots = snapshots.concat(this.options.data[key]);
			});

			// get an array of uniq particles
			let uids = [];
			snapshots.forEach(snapshot => {
				if (uids.indexOf(snapshot[this.options.dataFormat.idIndex]) === -1) uids.push(snapshot[this.options.dataFormat.idIndex]);
			});

			// step backwards from the end of the sim collecting
			// final snapshots for each uniq particle
			keys.reverse();

			for (let i = 0; i < keys.length; i++) {

				if (uids.length === 0) break;

				// check each particle in the snapshot
				this.options.data[keys[i]].forEach(snapshot => {

					// if not recorded
					let index = uids.indexOf(snapshot[this.options.dataFormat.idIndex]);
					if (index !== -1) {

						// grab it, and remove it from the list
						finalData.push({
							lat: snapshot[this.options.dataFormat.latIndex],
							lng: snapshot[this.options.dataFormat.lonIndex],
							value: this.options.finalIntensity
						});
						uids.splice(index, 1);
					}
				});
			}

			return {
				max: 10,
				data: finalData
			};
		},

		/**
	  * Process data into expected leaflet.heat format,
	  * plotting all particles for every snapshot
	  * [ [lat, lon, intensity], ... ]
	  * @private
	  */
		_createExposureData() {

			let exposureData = [];
			let keys = Object.keys(this.options.data);

			keys.forEach(key => {
				this.options.data[key].forEach(particle => {
					exposureData.push({
						lat: particle[this.options.dataFormat.latIndex],
						lng: particle[this.options.dataFormat.lonIndex],
						uid: particle[this.options.dataFormat.idIndex],
						value: this.options.exposureIntensity
					});
				});
			});

			return { min: 0, max: 10, data: exposureData };
		},

		/**
	  * Create the display layer (heatmap) for cumulative EXPOSURE
	  * @private
	  */
		_initDisplayExposure() {

			this._clearDisplay();

			if (this.options.data) {
				this._createColors();
				const exposureData = this._createExposureData();
				console.log(exposureData);
				this._particleLayer = L.heatBin(this.options.heatOptions);
				this._particleLayer.addTo(this._map);
				this._particleLayer.setData(exposureData);
			}
		},

		/**
	  * Create the display layer (L.CircleMarkers) for KEYFRAME's
	  * @private
	  */
		_initDisplayKeyframe() {

			this._clearDisplay();

			if (this.options.data) {
				// init the feature group and display first frame
				this._createColors();
				this._particleLayer = L.featureGroup();
				this._markers = [];
				this.setFrameIndex(this._frameIndex);
				this._particleLayer.addTo(this._map);
			} else {
				console.error('Attempted to display keyframes but there is no data.');
			}
		},

		/**
	  * Deep merge Objects,
	  * Note that destination arrays will be overwritten where they exist in source.
	  * @param destination
	  * @param source
	  * @returns {*}
	  */
		_extendObject(destination, source) {
			let self = this;
			for (const property in source) {
				// .constructor avoids tripping over prototypes etc.
				// don't traverse the data..
				if (property === 'data') {
					destination[property] = source[property];
				} else if (source[property] && source[property].constructor && source[property].constructor === Object) {
					destination[property] = destination[property] || {};
					self._extendObject(destination[property], source[property]);
				} else {
					destination[property] = source[property];
				}
			}
			return destination;
		}

	});

	L.particleDispersionLayer = function (options) {
		return new ParticleDispersionLayer(options);
	};

	var L_ParticleDispersionLayer = L.particleDispersionLayer;

	return L_ParticleDispersionLayer;

})));
//# sourceMappingURL=leaflet-particle-dispersion.js.map
