# leaflet-particle-dispersion [![NPM version][npm-image]][npm-url] [![NPM Downloads][npm-downloads-image]][npm-url]

Visualise dispersion of particles on a leaflet map.

Creates a custom leaflet layer with display modes:
- **Final particle distribution:**
  - final downstream (source) or upstream (sink) percentages
- **Cumulative exposure:**
  - percentage passing through cell from an upstream source or to a downstream sink
  - displays a heat-map of total exposure
- **Animation:**
  - use key frames to facilitate animation of particle positions over time
  - displays circles at particle locations, colored by their age

## todo
- unify color scale options for diff displayModes
- better parameterisation of styling, options

## install
Assuming you have node and npm installed:
```shell
npm install leaflet-particle-dispersion --save
```

## dependencies
This plugin depends on [chroma-js](https://github.com/gka/chroma.js),
and [leaflet.heat](https://github.com/Leaflet/Leaflet.heat).

To use this plugin, you either need to:
 - load these dependencies yourself (prior to loading `leaflet-particle-dispersion`); or
 - use the standalone version with dependencies bundled, in `dist/leaflet-particle-dispersion-standalone.js`

## use and options

```javascript
// create a particle layer
const mode = 'FINAL';
const particleLayer = L.particleDispersionLayer({

  // an array of keyframes, default: null
  data: data,

  // one of: 'FINAL', 'EXPOSURE', 'KEYFRAME', default: null
  displayMode: mode,

  // which keyframe should display on init, default: 0
  startFrameIndex: 0,

  // the colors to use in chroma-js scale, default: (shown below)
  ageColorScale: ['green', 'yellow', 'red'],

  // the domain to fit the ageColorScale, default: keyframe length
  ageDomain: [0, 100]

});

// add the layer to overlay control
const layerControl = L.control.layers({}, { particles: particleLayer });
layerControl.addTo(map);

// data and display mode can be updated like:
particleLayer.setData(newData);
particleLayer.setDisplayMode('KEYFRAME');

// when in keyframe mode, set active frame like:
particleLayer.setFrameIndex(index);
```

## public methods

|method|params|description|
|---|---|---|
|`isActive`||check if the particle layer is currently active on the map|
|`setData`|`data: {Object}`|update the layer with new data|
|`setDisplayMode`|`mode: {String}`|one of: `FINAL`, `EXPOSURE`, `KEYFRAME`|
|`setFrameIndex`|`index: {Number}`|display the particles at the given frame index|

## data format

```javascript
const data = {
  // ISO timestamp for each keyframe
  // contains an array of particles (each particle snapshot is represented by an array)
  "2017-03-02T01:00:00.000Z": [
    [
	  6,       // particle id
	  145.077, // lon
	  10.0710, // lat
	  0.5,     // depth (m)
	  1.0      // age
	],
	..
  ],
  "2017-03-02T02:00:00.000Z": [...]
```

## License
MIT License (MIT)

[npm-image]: https://badge.fury.io/js/leaflet-particle-dispersion.svg
[npm-url]: https://www.npmjs.com/package/leaflet-particle-dispersion
[npm-downloads-image]: https://img.shields.io/npm/dt/leaflet-particle-dispersion.svg