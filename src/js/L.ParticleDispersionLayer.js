L.ParticleDispersionLayer = (L.Layer ? L.Layer : L.Class).extend({

	// particle data indices
	_pidIndex:    0,
	_pLatIndex:   1,
	_pLonIndex:   0,
	_pDepthIndex: 2,
	_pAgeIndex:   3,

	// misc
	_particleLayer: null,
	_frameIndex:   0,
	_markers:      [],
	_colors:       null,

	/*------------------------------------ LEAFLET SPECIFIC ------------------------------------------*/

	// user options
	options: {
		data:            null,
		displayMode:     null,
		startFrameIndex: 0,
		ageColorScale:   null,
		ageDomain:       null
	},

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

		console.log('options');
		console.log(this);
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
		L.DomUtil.remove(this._pane);
		this._renderer = null;
		this._particleLayer = null;
	},

	/*------------------------------------ PUBLIC ------------------------------------------*/

	/**
	 * Update the layer with new data
	 * @param data
	 */
	setData (data) {
		this.options.data = data;
	},

	/**
	 * Set the display mode of the layer
	 * @param mode {string} One of: ['FINAL', 'EXPOSURE', 'KEYFRAME']
	 */
	setDisplayMode (mode) {

		console.log(`setDisplayMode: ${mode}`);

		this.options.displayMode = mode;

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

	setFrameIndex (index) {

		console.log(`setFrameIndex: ${index}`);

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

				// would be more efficient to have single tooltip for featureGroup..
			}).bindTooltip(`I love to parti-cle..`, { sticky: true });

			self._markers.push(marker);
			self._particleLayer.addLayer(marker);
		}
	},

	/*------------------------------------ PRIVATE ------------------------------------------*/

	_createRenderer () {
		// create separate pane for canvas renderer
		this._pane = this._map.createPane('particle-dispersion');
		this._renderer = L.canvas({ pane: 'particle-dispersion' });
	},

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

	_initDisplayFinal () {
		this._clearDisplay();
		this._createColors();
	},

	/**
	 * Process data into expected leaflet.heat format:
	 * [ [lat, lon, intensity], ... ]
	 * @private
	 */
	_createHeatmapData () {

		let heatData = [];
		let keys = Object.keys(this.options.data);
		let maxAge = Object.keys(this.options.data).length;

		keys.forEach((key) => {
			this.options.data[key].forEach((particle) => {
				heatData.push([
					particle[this._pLatIndex],         // lat
					particle[this._pLonIndex],         // lon
					particle[this._pAgeIndex] / maxAge // scaled age
				]);
			});
		});

		return heatData;
	},

	_initDisplayExposure () {
		this._clearDisplay();

		if (this.options.data){
			this._createColors();

			let heatData = this._createHeatmapData();

			console.log(heatData);

			this._particleLayer = L.heatLayer(heatData, { radius: 15 });
			this._particleLayer.addTo(this._map);
		}
	},

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