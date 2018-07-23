'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/*
 * Leaflet Heatmap Overlay
 *
 * Copyright (c) 2008-2016, Patrick Wied (https://www.patrick-wied.at)
 * Dual-licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and the Beerware (http://en.wikipedia.org/wiki/Beerware) license.
 *
 *
 * 2018 <danwild@y7mail.com> Modified to handle radiusMeters.
 */
(function (factory, window) {

	// Supports UMD. AMD, CommonJS/Node.js and browser context
	if (typeof module !== "undefined" && module.exports) {
		module.exports = factory(require('heatmap.js'), require('leaflet'));
	} else if (typeof define === "function" && define.amd) {
		define(['heatmap.js', 'leaflet'], factory);
	} else {

		if (window.h337 && window.L) {
			window.HeatmapOverlay = factory(window.h337, window.L);
		} else {
			throw new Error('Tried to init in browser context but had missing dependencies.');
		}
	}
})(function (h337, L) {

	'use strict';

	// Leaflet < 0.8 compatibility

	if (typeof L.Layer === 'undefined') {
		L.Layer = L.Class;
	}

	var HeatmapOverlay = L.Layer.extend({

		initialize: function initialize(config) {
			this.cfg = config;
			this._el = L.DomUtil.create('div', 'leaflet-zoom-hide');
			this._data = [];
			this._max = 1;
			this._min = 0;
			this.cfg.container = this._el;
		},

		onAdd: function onAdd(map) {
			var size = map.getSize();

			this._map = map;

			this._width = size.x;
			this._height = size.y;

			this._el.style.width = size.x + 'px';
			this._el.style.height = size.y + 'px';
			this._el.style.position = 'absolute';

			this._origin = this._map.layerPointToLatLng(new L.Point(0, 0));

			map.getPanes().overlayPane.appendChild(this._el);

			if (!this._heatmap) {
				this._heatmap = h337.create(this.cfg);
			}

			// this resets the origin and redraws whenever
			// the zoom changed or the map has been moved
			map.on('moveend', this._reset, this);
			this._draw();
		},

		addTo: function addTo(map) {
			map.addLayer(this);
			return this;
		},

		onRemove: function onRemove(map) {
			// remove layer's DOM elements and listeners
			map.getPanes().overlayPane.removeChild(this._el);

			map.off('moveend', this._reset, this);
		},

		_draw: function _draw() {
			if (!this._map) {
				return;
			}

			var mapPane = this._map.getPanes().mapPane;
			var point = mapPane._leaflet_pos;

			// reposition the layer
			this._el.style[HeatmapOverlay.CSS_TRANSFORM] = 'translate(' + -Math.round(point.x) + 'px,' + -Math.round(point.y) + 'px)';

			this._update();
		},

		_getPixelRadius: function _getPixelRadius() {

			var centerLatLng = this._map.getCenter();
			var pointC = this._map.latLngToContainerPoint(centerLatLng);
			var pointX = [pointC.x + 1, pointC.y];

			// convert containerpoints to latlng's
			var latLngC = this._map.containerPointToLatLng(pointC);
			var latLngX = this._map.containerPointToLatLng(pointX);

			// Assuming distance only depends on latitude
			var distanceX = latLngC.distanceTo(latLngX);
			// 100 meters is the fixed distance here
			var pixels = this.cfg.radiusMeters / distanceX;

			return pixels >= 1 ? pixels : 1;
		},

		_update: function _update() {

			var bounds, zoom, scale;
			var generatedData = { max: this._max, min: this._min, data: [] };

			bounds = this._map.getBounds();
			zoom = this._map.getZoom();
			scale = Math.pow(2, zoom);

			if (this._data.length == 0) {
				if (this._heatmap) {
					this._heatmap.setData(generatedData);
				}
				return;
			}

			var latLngPoints = [];
			var radiusMultiplier = this.cfg.scaleRadius ? scale : 1;
			var localMax = 0;
			var localMin = 0;
			var valueField = this.cfg.valueField;
			var len = this._data.length;

			while (len--) {
				var entry = this._data[len];
				var value = entry[valueField];
				var latlng = entry.latlng;

				// we don't wanna render points that are not even on the map ;-)
				if (!bounds.contains(latlng)) {
					continue;
				}
				// local max is the maximum within current bounds
				localMax = Math.max(value, localMax);
				localMin = Math.min(value, localMin);

				var point = this._map.latLngToContainerPoint(latlng);
				var latlngPoint = { x: Math.round(point.x), y: Math.round(point.y) };
				latlngPoint[valueField] = value;

				var radius;

				if (this.cfg.radiusMeters) {
					radius = this._getPixelRadius();
				} else if (entry.radius) {
					radius = entry.radius * radiusMultiplier;
				} else {
					radius = (this.cfg.radius || 2) * radiusMultiplier;
				}
				latlngPoint.radius = radius;
				latLngPoints.push(latlngPoint);
			}
			if (this.cfg.useLocalExtrema) {
				generatedData.max = localMax;
				generatedData.min = localMin;
			}

			generatedData.data = latLngPoints;
			this._heatmap.setData(generatedData);
		},
		setData: function setData(data) {
			this._max = data.max || this._max;
			this._min = data.min || this._min;
			var latField = this.cfg.latField || 'lat';
			var lngField = this.cfg.lngField || 'lng';
			var valueField = this.cfg.valueField || 'value';

			// transform data to latlngs
			var data = data.data;
			var len = data.length;
			var d = [];

			while (len--) {
				var entry = data[len];
				var latlng = new L.LatLng(entry[latField], entry[lngField]);
				var dataObj = { latlng: latlng };
				dataObj[valueField] = entry[valueField];
				if (entry.radius) {
					dataObj.radius = entry.radius;
				}
				d.push(dataObj);
			}
			this._data = d;

			this._draw();
		},
		// experimential... not ready.
		addData: function addData(pointOrArray) {
			if (pointOrArray.length > 0) {
				var len = pointOrArray.length;
				while (len--) {
					this.addData(pointOrArray[len]);
				}
			} else {
				var latField = this.cfg.latField || 'lat';
				var lngField = this.cfg.lngField || 'lng';
				var valueField = this.cfg.valueField || 'value';
				var entry = pointOrArray;
				var latlng = new L.LatLng(entry[latField], entry[lngField]);
				var dataObj = { latlng: latlng };

				dataObj[valueField] = entry[valueField];
				this._max = Math.max(this._max, dataObj[valueField]);
				this._min = Math.min(this._min, dataObj[valueField]);

				if (entry.radius) {
					dataObj.radius = entry.radius;
				}
				this._data.push(dataObj);
				this._draw();
			}
		},
		_reset: function _reset() {
			this._origin = this._map.layerPointToLatLng(new L.Point(0, 0));

			var size = this._map.getSize();
			if (this._width !== size.x || this._height !== size.y) {
				this._width = size.x;
				this._height = size.y;

				this._el.style.width = this._width + 'px';
				this._el.style.height = this._height + 'px';

				this._heatmap._renderer.setDimensions(this._width, this._height);
			}
			this._draw();
		}
	});

	HeatmapOverlay.CSS_TRANSFORM = function () {
		var div = document.createElement('div');
		var props = ['transform', 'WebkitTransform', 'MozTransform', 'OTransform', 'msTransform'];

		for (var i = 0; i < props.length; i++) {
			var prop = props[i];
			if (div.style[prop] !== undefined) {
				return prop;
			}
		}
		return props[0];
	}();

	return HeatmapOverlay;
}, window);
(function (factory, window) {

	// AMD
	if (typeof define === 'function' && define.amd) {
		define(['leaflet', 'heatmap.js', 'HeatmapOverlay', 'chroma-js'], factory);

		// Common JS
	} else if ((typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object') {
		module.exports = factory(require('leaflet'), require('heatmap.js'), require('HeatmapOverlay'), require('chroma-js'));
	} else {

		// Global
		if (typeof window !== 'undefined' && window.L && window.HeatmapOverlay && window.chroma) {
			window.L.particleDispersionLayer = factory(L, window.HeatmapOverlay, window.chroma);
		} else {
			throw new Error('Tried to init in browser context but had missing dependencies.');
		}
	}
})(function (L, HeatmapOverlay, chroma) {

	var ParticleDispersionLayer = (L.Layer ? L.Layer : L.Class).extend({

		// particle data indices
		_pidIndex: 0,
		_pLatIndex: 1,
		_pLonIndex: 0,
		_pDepthIndex: 2,
		_pAgeIndex: 3,
		//_pidIndex:    0,
		//_pLatIndex:   1 + 1,
		//_pLonIndex:   0 + 1,
		//_pDepthIndex: 2 + 1,
		//_pAgeIndex:   3 + 1,

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
			displayMode: '',
			startFrameIndex: 0,
			ageColorScale: null,
			ageDomain: null,
			exposureHeatOptions: {},
			finalHeatOptions: {
				blur: 1,
				// radius should be small ONLY if scaleRadius is true (or small radius is intended)
				// if scaleRadius is false it will be the constant radius used in pixels
				"radiusMeters": 1000,
				"radius": 20,
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
				valueField: 'value',
				onExtremaChange: function onExtremaChange(data) {
					console.log('onExtremaChange');
					console.log(data);
				}
			},

			exposureIntensity: 1,
			finalIntensity: 1
		},

		initialize: function initialize(options) {
			// (L.setOptions was not working as expected)
			this.options = this._extendObject(this.options, options);
		},

		/**
   * Initialise renderer when layer is added to the map / becomes active,
   * and draw circle markers if user has specified the displayMode
   *
   * @param map {Object} Leaflet map
   */
		onAdd: function onAdd(map) {
			this._active = true;
			this._map = map;
			this._createRenderer();
			if (this.options.displayMode) this.setDisplayMode(this.options.displayMode);
		},

		/**
   * Remove the pane from DOM, and void renderer when layer removed from map
   */
		onRemove: function onRemove() {
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
		isActive: function isActive() {
			return this._active;
		},


		/**
   * Update the layer with new data
   * @param data
   */
		setData: function setData(data) {
			this.options.data = data;
			this.setDisplayMode(this.options.displayMode);
		},


		/**
   * Set the display mode of the layer
   * @param mode {string} One of: ['FINAL', 'EXPOSURE', 'KEYFRAME']
   */
		setDisplayMode: function setDisplayMode(mode) {

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
					console.error('Attempted to initialise with invalid displayMode: ' + this.options.displayMode);
					break;
			}
		},


		/**
   * Display the particles at the given frame index
   * @param index {number} the keyframe index
   */
		setFrameIndex: function setFrameIndex(index) {

			if (!this.isActive()) return;
			var self = this;
			self._frameIndex = index;

			var keys = Object.keys(self.options.data);
			var frame = self.options.data[keys[index]];

			// there's no addLayer*s* function, either need to add each
			// L.circleMarker individually, or reinit the entire layer
			if (self._particleLayer) self._particleLayer.clearLayers();

			for (var i = 0; i < frame.length; i++) {

				var particle = frame[i];
				var pos = self._map.wrapLatLng([particle[self._pLatIndex], particle[self._pLonIndex]]);
				var marker = L.circleMarker(pos, {
					renderer: self._renderer,
					stroke: false,
					fillOpacity: 0.3,
					radius: 8,
					fillColor: this._colors(particle[self._pAgeIndex]).hex(),
					_feature: particle

				});

				self._markers.push(marker);
				self._particleLayer.addLayer(marker);
			}
		},


		/*------------------------------------ PRIVATE ------------------------------------------*/

		/**
   * Create the L.canvas renderer and custom pane to display particles
   * @private
   */
		_createRenderer: function _createRenderer() {
			// create separate pane for canvas renderer
			this._pane = this._map.createPane('particle-dispersion');
			this._renderer = L.canvas({ pane: 'particle-dispersion' });
		},


		/**
   * Remove the particle layer from the map and clear our reference
   * @private
   */
		_clearDisplay: function _clearDisplay() {
			if (this._particleLayer) this._map.removeLayer(this._particleLayer);
			this._particleLayer = null;
		},


		/**
   * @summary Create a chroma-js color scale with user settings or auto scaled to keyframe range
   * @returns {Object} chromaJs color object
   * @private
   */
		_createColors: function _createColors() {
			if (!this.options.ageDomain) this.options.ageDomain = [0, Object.keys(this.options.data).length];
			this._colors = chroma.scale(this.options.ageColorScale).domain(this.options.ageDomain);
			return this._colors;
		},


		/**
   * Create the display layer (heatmap) for FINAL distribution.
   * @private
   */
		_initDisplayFinal: function _initDisplayFinal() {

			this._clearDisplay();

			if (this.options.data) {

				this._createColors();
				var finalData = this._createFinalData();

				this._particleLayer = new HeatmapOverlay(this.options.finalHeatOptions);
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
		_createFinalData: function _createFinalData() {
			var _this = this;

			var finalData = [];

			// get keys, moving forward in time
			var keys = Object.keys(this.options.data);
			keys.sort(function (a, b) {
				return new Date(a) - new Date(b);
			});

			// flatten the data
			var snapshots = [];
			keys.forEach(function (key) {
				snapshots = snapshots.concat(_this.options.data[key]);
			});

			// get an array of uniq particles
			var uids = [];
			snapshots.forEach(function (snapshot) {
				if (uids.indexOf(snapshot[_this._pidIndex]) === -1) uids.push(snapshot[_this._pidIndex]);
			});

			// step backwards from the end of the sim collecting
			// final snapshots for each uniq particle
			keys.reverse();

			for (var i = 0; i < keys.length; i++) {

				if (uids.length === 0) break;

				// check each particle in the snapshot
				this.options.data[keys[i]].forEach(function (snapshot) {

					// if not recorded
					var index = uids.indexOf(snapshot[_this._pidIndex]);
					if (index !== -1) {

						// grab it, and remove it from the list
						finalData.push({
							lat: snapshot[_this._pLatIndex],
							lng: snapshot[_this._pLonIndex],
							value: _this.options.finalIntensity
						});
						uids.splice(index, 1);
					}
				});
			}

			return {
				max: 200,
				data: finalData
			};
		},


		/**
   * Process data into expected leaflet.heat format,
   * plotting all particles for every snapshot
   * [ [lat, lon, intensity], ... ]
   * @private
   */
		_createExposureData: function _createExposureData() {
			var _this2 = this;

			var exposureData = [];
			var keys = Object.keys(this.options.data);

			keys.forEach(function (key) {
				_this2.options.data[key].forEach(function (particle) {
					exposureData.push([particle[_this2._pLatIndex], // lat
					particle[_this2._pLonIndex], // lon
					_this2.options.exposureIntensity // intensity
					]);
				});
			});

			return exposureData;
		},


		/**
   * Create the display layer (heatmap) for cumulative EXPOSURE
   * @private
   */
		_initDisplayExposure: function _initDisplayExposure() {
			this._clearDisplay();

			if (this.options.data) {
				this._createColors();
				var exposureData = this._createExposureData();
				this._particleLayer = L.heatLayer(exposureData, this.options.exposureHeatOptions);
				this._particleLayer.addTo(this._map);
			}
		},


		/**
   * Create the display layer (L.CircleMarkers) for KEYFRAME's
   * @private
   */
		_initDisplayKeyframe: function _initDisplayKeyframe() {

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
		_extendObject: function _extendObject(destination, source) {
			var self = this;
			for (var property in source) {
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

	return L.particleDispersionLayer;
}, window);