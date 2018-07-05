L.ParticleDispersionLayer = (L.Layer ? L.Layer : L.Class).extend({

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

	// user options
	options: {
		data:            null,
		displayMode:     '',
		startFrameIndex: 0,
		ageColorScale:   null,
		ageDomain:       null
	},

	_active: false,
	_map:      null,
	// the L.canvas renderer
	_renderer: null,
	// the DOM leaflet-pane that contains html canvas
	_pane:     null,

	initialize (options) {
		L.setOptions(this, options);
	},

	/**
	 * Initialise renderer when layer is added to the map / becomes active,
	 * and draw circle markers if user has specified the displayMode
	 *
	 * @param map {Object} Leaflet map
	 */
	onAdd (map) {

		this._active = true;

		console.log('options');
		console.log(this.options);

		this._map = map;

		if (this.options.hasOwnProperty('startFrameIndex')) this._frameIndex = this.options.startFrameIndex;
		this.options.ageColorScale = this.options.ageColorScale || ['green', 'yellow', 'red'];
		this.options.ageDomain = this.options.ageDomain || null;

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

			}).bindTooltip(`I love to parti-cle..`, { sticky: true });

			self._markers.push(marker);
			self._particleLayer.addLayer(marker);
		}
	},

	/*------------------------------------ PRIVATE ------------------------------------------*/

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
			let finalData = this._createFinalData();
			this._particleLayer = L.heatLayer(finalData, { radius: 15 });
			this._particleLayer.addTo(this._map);
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

		// get keys, moving forward in time
		let keys = Object.keys(this.options.data);
		keys.sort((a, b) => { return new Date(a) - new Date(b); });

		// flatten the data
		let snapshots = [];
		keys.forEach((key) => { snapshots = snapshots.concat(this.options.data[key]); });

		// get an array of uniq particles
		let uids = [];
		snapshots.forEach((snapshot) => {
			if (uids.indexOf(snapshot[this._pidIndex]) === -1) uids.push(snapshot[this._pidIndex]);
		});

		// step backwards from the end of the sim collecting
		// final snapshots for each uniq particle
		keys.reverse();

		for (let i = 0; i < keys.length; i++) {

			if (uids.length === 0) break;

			// check each particle in the snapshot
			this.options.data[keys[i]].forEach((snapshot) => {

				// if not recorded
				let index = uids.indexOf(snapshot[this._pidIndex]);
				if (index !== -1) {

					// grab it, and remove it from the list
					finalData.push([
						snapshot[this._pLatIndex],
						snapshot[this._pLonIndex],
						0.9
					]);
					uids.splice(index, 1);
				}

			});
		}

		return finalData;
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
		let maxAge = Object.keys(this.options.data).length;

		keys.forEach((key) => {
			this.options.data[key].forEach((particle) => {
				exposureData.push([
					particle[this._pLatIndex],         // lat
					particle[this._pLonIndex],         // lon
					0.2
					// particle[this._pAgeIndex] / maxAge // scaled age?
				]);
			});
		});

		return exposureData;
	},

	/**
	 * Create the display layer (heatmap) for cumulative EXPOSURE
	 * @private
	 */
	_initDisplayExposure () {
		this._clearDisplay();

		if (this.options.data){
			this._createColors();
			let exposureData = this._createExposureData();
			this._particleLayer = L.heatLayer(exposureData, { radius: 15 });
			this._particleLayer.addTo(this._map);
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
	}

});

L.particleDispersionLayer = function(options) {
	return new L.ParticleDispersionLayer(options);
};