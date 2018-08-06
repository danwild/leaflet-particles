# leaflet-particles [![NPM version][npm-image]][npm-url] [![NPM Downloads][npm-downloads-image]][npm-url]

**VERY ALPHA** plugin visualise dispersion of particles on a leaflet map.

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
npm install leaflet-particles --save
```

## dependencies

This plugin has external dependencies:
- [chroma-js](https://github.com/gka/chroma.js)
- [leaflet-heatbin](https://github.com/danwild/leaflet-heatbin)

To use this plugin, you either need to:
 - load these dependencies yourself (prior to loading `leaflet-particles`); or
 - use the standalone version with dependencies bundled, in `dist/leaflet-particles-standalone.js`


## use and options

```javascript
// create a particle layer
const mode = 'FINAL';
const particleLayer = L.particlesLayer({

  // an array of keyframes, default: null
  data: data,

  // define the indices of your data point arrays, default:
  dataFormat: {
    idIndex:    0,
    lonIndex:   1,
    latIndex:   2,
    depthIndex: 3,
    ageIndex:   4
  },

  // one of: 'FINAL', 'EXPOSURE', 'KEYFRAME', default: null
  displayMode: mode,

  // which keyframe should display on init, default: 0
  startFrameIndex: 0,

  // the colors to use in chroma-js scale, default: (shown below)
  ageColorScale: ['green', 'yellow', 'red'],

  // the domain to fit the ageColorScale, default: keyframe length
  ageDomain: [0, 100],

  // heatmap.js options for heatmap layers, see:
  // https://www.patrick-wied.at/static/heatmapjs/example-heatmap-leaflet.html
  // note that additionally; we have an enhanced version of the leaflet-heatmap.js plugin (see /src)
  // that provides advanced cell/radius options, see: https://github.com/danwild/leaflet-heatbin
  heatOptions: {

    // example fixed radius of 1000m
    fixedRadius: true,
    radiusMeters: 1000,

    // e.g. bin values into 250m grid cells
    heatBin: {
      enabled: true,
      cellSizeKm: 0.25
    }
  },

  // the intensity value to use for each point on the heatmap, default: 1
  // only used if not heatBin.enabled
  exposureIntensity: 1,
  finalIntensity: 1,

  // callback when layer is removed, use for cleanup
  onRemove: function(){}

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
|`update`||update the layer/redraw|
|`setOptions`|`options: {Object}`|update the layer with new options|
|`setDisplayMode`|`mode: {String}`|one of: `FINAL`, `EXPOSURE`, `KEYFRAME`|
|`getDisplayMode`||Returns the current `displayMode`|
|`setFrameIndex`|`index: {Number}`|display the particles at the given frame index|
|`getGridInfo`||A wrapper function for `L.heatBin.getGridInfo` to get information about the grid used for binning|
|`getParticleLayer`||get the current underlying map layer used for drawing **READONLY**|

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

[npm-image]: https://badge.fury.io/js/leaflet-particles.svg
[npm-url]: https://www.npmjs.com/package/leaflet-particles
[npm-downloads-image]: https://img.shields.io/npm/dt/leaflet-particles.svg