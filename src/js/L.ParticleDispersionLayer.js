
// dependencies
import chroma from 'chroma-js';
import heatmap from 'heatmap.js';
import turf from 'turf';
import heatBin from 'leaflet-heatbin';

const ParticleDispersionLayer = (L.Layer ? L.Layer : L.Class).extend({

	// particle data indices
	_pidIndex:    0,
	_pLatIndex:   1,
	_pLonIndex:   0,
	_pDepthIndex: 2,
	_pAgeIndex:   3,
	//_pidIndex:    0,
	//_pLatIndex:   1 + 1,
	//_pLonIndex:   0 + 1,
	//_pDepthIndex: 2 + 1,
	//_pAgeIndex:   3 + 1,

	// misc
	_particleLayer: null,
	_frameIndex:   0,
	_markers:      [],
	_colors:       null,

	/*------------------------------------ LEAFLET SPECIFIC ------------------------------------------*/

	_active: false,
	_map:      null,
	// the L.canvas renderer
	_renderer: null,
	// the DOM leaflet-pane that contains html canvas
	_pane:     null,

	// user options
	options: {
		data:            null,
		displayMode:     '',
		startFrameIndex: 0,
		ageColorScale:   null,
		ageDomain:       null,
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
	onRemove () {
		this._map.removeLayer(this._particleLayer);
		L.DomUtil.remove(this._pane);
		this._renderer = null;
		this._particleLayer = null;
		this._active = false;
	},

	/*------------------------------------ PUBLIC ------------------------------------------*/

	/**
	 * check if the particle layer is currently active on the map
	 * @returns {boolean}
	 */
	isActive () {
		return this._active;
	},

	/**
	 * Update the layer with new data
	 * @param data
	 */
	setData (data) {
		this.options.data = data;
		this.setDisplayMode(this.options.displayMode);
	},

	/**
	 * Set options object, updates layer
	 * @param options
	 */
	setOptions (options) {
		this.options = this._extendObject(this.options, options);
		this.update();
	},

	/**
	 * Trigger layer update/redraw
	 */
	update () {
		this.setDisplayMode(this.options.displayMode);
	},

	/**
	 * Set the display mode of the layer
	 * @param mode {string} One of: ['FINAL', 'EXPOSURE', 'KEYFRAME']
	 */
	setDisplayMode (mode) {

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
	getDisplayMode () {
		return this.options.displayMode;
	},

	/**
	 * Display the particles at the given frame index
	 * @param index {number} the keyframe index
	 */
	setFrameIndex (index) {

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
			const pos = self._map.wrapLatLng([particle[self._pLatIndex], particle[self._pLonIndex]]);
			let marker = L.circleMarker(pos, {
				renderer:    self._renderer,
				stroke:      false,
				fillOpacity: 0.3,
				radius: 8,
				fillColor:   this._colors(particle[self._pAgeIndex]).hex(),
				_feature:    particle

			});

			self._markers.push(marker);
			self._particleLayer.addLayer(marker);
		}
	},

	/**
	 * Returns leaflet LatLngBounds of the layer
	 */
	getLatLngBounds () {

		if (!this.options.data || !this._map) return null;

		// get keys, flatten the data
		const snapshots = this._flattened();

		return L.latLngBounds(snapshots.map((s) => {
			return this._map.wrapLatLng([s[this._pLatIndex], s[this._pLonIndex]]);
		}));
	},

	/*------------------------------------ PRIVATE ------------------------------------------*/

	_flattened () {
		let keys = Object.keys(this.options.data);
		let snapshots = [];
		keys.forEach((key) => { snapshots = snapshots.concat(this.options.data[key]); });
		return snapshots;
	},

	_flattenedPoints () {
		let keys = Object.keys(this.options.data);
		let snapshots = [];
		keys.forEach((key) => { snapshots = snapshots.concat(this.options.data[key]); });

		return {
			type: "FeatureCollection",
			features: snapshots.map((s) => {
				return {
					"type": "Feature",
					"geometry": {
						"type": "Point",
						"coordinates": [s[this._pLonIndex], s[this._pLatIndex]]
					},
					"properties": {
						"id": s[this._pidIndex],
						"depth": s[this._pDepthIndex],
						"age": s[this._pAgeIndex]
					}
				}
			})
		}
	},

	_computeHeatmapGrid () {

		// CREATE BBOX
		const bounds = this.getLatLngBounds();
		// minX, minY, maxX, maxY
		const bbox = [
			bounds.getWest(),
			bounds.getNorth(),
			bounds.getEast(),
			bounds.getSouth()
		];

		const bottomLeft = [bounds.getWest(), bounds.getSouth()];
		const bottomRight = [bounds.getEast(), bounds.getSouth()];
		const topLeft = [bounds.getWest(), bounds.getNorth()];
		const topRight = [bounds.getEast(), bounds.getNorth()];

		// CREATE A GRID OF CELLS
		// GRID origin is bottomRight
		// the indexes increment by:
		// xCol=0, yRow upwards, then xCol=1 etc.
		const lengthKm = 0.25;
		const grid = turf.squareGrid(bbox, lengthKm, { units: 'kilometers' });

		grid.features.reverse();
		grid.features.forEach((f, index) => { f.properties['index'] = index; });
		console.log(grid);

		// DEBUG - plot the binning grid on map
		//L.geoJSON(grid, {
		//	style: function (feature) {
		//		return {
		//			weight: 1,
		//			fill: false
		//		}
		//	},
		//	onEachFeature: function (feature, layer) {
		//		layer.bindTooltip(`index: ${feature.properties.index}`);
		//	}
		//}).addTo(this._map);

		// calc XY lengths
		const xGridLength = turf.distance(turf.point(bottomLeft), turf.point(bottomRight), { units: 'kilometers' });
		const yGridLength = turf.distance(turf.point(bottomLeft), turf.point(topLeft), { units: 'kilometers' });
		console.log(`xGridLenth: ${xGridLength}, yGridLenth: ${yGridLength}`);

		// calc XY cell length of grid
		const xCellLength = Math.floor(xGridLength / lengthKm);
		const yCellLength = Math.floor(yGridLength / lengthKm);
		const totalCells = xCellLength * yCellLength;
		console.log(`xCellLenth: ${xCellLength}, yCellLenth: ${yCellLength}`);
		console.log(`total cells: ${totalCells}`);

		// PUT EACH SNAPSHOT INTO A CELL
		const points = this._flattenedPoints();

		// for each point get its offset from minX and minY
		points.features.forEach((f) => {

			// point dist from left
			const xDist = turf.distance(
				turf.point(f.geometry.coordinates),
				turf.point([bounds.getEast(), f.geometry.coordinates[1]]),
				{ units: 'kilometers' }
			);
			// point dist from bottom
			const yDist = turf.distance(
				turf.point(f.geometry.coordinates),
				turf.point([f.geometry.coordinates[0], bounds.getSouth()]),
				{ units: 'kilometers' }
			);

			// find the XY cell indices
			let xCell = Math.round(xDist / lengthKm);
			let yCell = Math.round(yDist / lengthKm);

			// translate 2D index into 1D index
			let i = (xCell * yCellLength) + yCell;
			if (i >= totalCells) i = totalCells - 1;

			if (grid.features[i].properties.count) {
				grid.features[i].properties.count++
			} else {
				grid.features[i].properties['count'] = 1;
			}

		});

		console.log('tallied grid');
		console.log(grid);
		let valid = 0;
		grid.features.forEach((f) => { if (f.properties.count > 0) valid++; });
		console.log(valid);

		// USE EACH CELL AS A HEATMAP DATA POINT
		let heatmapCells = [];

		grid.features.forEach((f) => {
			if (f.properties.count) {
				let centroid = turf.centroid(f);
				heatmapCells.push({
					lat:   centroid.geometry.coordinates[1],
					lng:   centroid.geometry.coordinates[0],
					value: f.properties.count
				});
			}
		});

		return heatmapCells;
	},

	/**
	 * Create the L.canvas renderer and custom pane to display particles
	 * @private
	 */
	_createRenderer () {
		// create separate pane for canvas renderer
		this._pane = this._map.createPane('particle-dispersion');
		this._renderer = L.canvas({ pane: 'particle-dispersion' });
	},

	/**
	 * Remove the particle layer from the map and clear our reference
	 * @private
	 */
	_clearDisplay () {
		if (this._particleLayer) this._map.removeLayer(this._particleLayer);
		this._particleLayer = null;
	},

	/**
	 * @summary Create a chroma-js color scale with user settings or auto scaled to keyframe range
	 * @returns {Object} chromaJs color object
	 * @private
	 */
	_createColors () {
		if (!this.options.ageDomain) this.options.ageDomain = [0, Object.keys(this.options.data).length];
		this._colors = chroma.scale(this.options.ageColorScale).domain(this.options.ageDomain);
		return this._colors;
	},

	/**
	 * Create the display layer (heatmap) for FINAL distribution.
	 * @private
	 */
	_initDisplayFinal () {

		this._clearDisplay();

		if (this.options.data){

			this._createColors();
			const finalData = this._createFinalData();
			this._particleLayer = heatBin(this.options.heatOptions);
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
	_createFinalData () {

		let finalData = [];

		//// get keys, moving forward in time
		//let keys = Object.keys(this.options.data);
		//keys.sort((a, b) => { return new Date(a) - new Date(b); });
		//
		//// flatten the data
		//let snapshots = [];
		//keys.forEach((key) => { snapshots = snapshots.concat(this.options.data[key]); });
		//
		//// get an array of uniq particles
		//let uids = [];
		//snapshots.forEach((snapshot) => {
		//	if (uids.indexOf(snapshot[this._pidIndex]) === -1) uids.push(snapshot[this._pidIndex]);
		//});
		//
		//// step backwards from the end of the sim collecting
		//// final snapshots for each uniq particle
		//keys.reverse();
		//
		//for (let i = 0; i < keys.length; i++) {
		//
		//	if (uids.length === 0) break;
		//
		//	// check each particle in the snapshot
		//	this.options.data[keys[i]].forEach((snapshot) => {
		//
		//		// if not recorded
		//		let index = uids.indexOf(snapshot[this._pidIndex]);
		//		if (index !== -1) {
		//
		//			// grab it, and remove it from the list
		//			finalData.push({
		//				lat:   snapshot[this._pLatIndex],
		//				lng:   snapshot[this._pLonIndex],
		//				value: this.options.finalIntensity
		//			});
		//			uids.splice(index, 1);
		//		}
		//
		//	});
		//}

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
	_createExposureData () {

		let exposureData = [];
		let keys = Object.keys(this.options.data);

		keys.forEach((key) => {
			this.options.data[key].forEach((particle) => {
				let point = { lat: particle[this._pLatIndex], lng: particle[this._pLonIndex] };
				// only add intensity if not binning
				if (!this.options.heatOptions && !this.options.heatOptions.enabled) {
					point.value = this.options.exposureIntensity
				}
				exposureData.push(point);
			});
		});

		return {
			max: 10,
			data: exposureData
		};

		//const gridPoints = this._computeHeatmapGrid();
		//console.log('gridPoints');
		//console.log(gridPoints);
		//
		//return {
		//	max: gridPoints.map((p) => { return p.value; }).reduce(function(a, b) { return Math.max(a, b); }) / 100,
		//	data: gridPoints
		//};
		//const points = this._flattenedPoints();
		//return {
		//	max: 10, // Math.max(gridPoints.map((p) => { return p.value; })),
		//	data: points.features.map((p) => {
		//		return {
		//			lat: p.geometry.coordinates[1],
		//			lng: p.geometry.coordinates[0],
		//			value: this.options.exposureIntensity
		//		}
		//	})
		//};
	},

	/**
	 * Create the display layer (heatmap) for cumulative EXPOSURE
	 * @private
	 */
	_initDisplayExposure () {

		this._clearDisplay();

		if (this.options.data){
			this._createColors();
			const exposureData = this._createExposureData();
			this._particleLayer = heatBin(this.options.heatOptions);
			this._particleLayer.addTo(this._map);
			this._particleLayer.setData(exposureData);
		}
	},

	/**
	 * Create the display layer (L.CircleMarkers) for KEYFRAME's
	 * @private
	 */
	_initDisplayKeyframe () {

		this._clearDisplay();

		if (this.options.data){
			// init the feature group and display first frame
			this._createColors();
			this._particleLayer = L.featureGroup();
			this._markers = [];
			this.setFrameIndex(this._frameIndex);
			this._particleLayer.addTo(this._map);
		} else {
			console.error('Attempted to display keyframes but there is no data.')
		}
	},

	/**
	 * Deep merge Objects,
	 * Note that destination arrays will be overwritten where they exist in source.
	 * @param destination
	 * @param source
	 * @returns {*}
	 */
	_extendObject (destination, source) {
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

L.particleDispersionLayer = function(options) {
	return new ParticleDispersionLayer(options);
};

export default L.particleDispersionLayer;




