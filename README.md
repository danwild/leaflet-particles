# leaflet-particle-dispersion [![NPM version][npm-image]][npm-url] [![NPM Downloads][npm-downloads-image]][npm-url]

Visualise dispersion of particles on a leaflet map, uses L.CircleMarkers rendered with L.Canvas.

Creates a custom leaflet layer with display modes:
- **Final particle distribution:** Final downstream (source) or upstream (sink) percentages
- **Cumulative exposure:** Percentage passing through cell from an upstream source or to a downstream sink
- **Animation:** use key frames to facilitate animation of particle positions over time

## use and options

```javascript
// create a particle layer
const mode = 'FINAL';
const particleLayer = L.particleDispersionLayer({

  // an array of keyframes, default: null
  data:            data,

  // one of: 'FINAL', 'EXPOSURE', 'KEYFRAME', default: null
  displayMode:     mode,

  // which keyframe should display on init, default: 0
  startFrameIndex: 0,

  // the colors to use in chroma-js scale, default: (shown below)
  ageColorScale:   ['green', 'yellow', 'red'],

  // the domain to fit the ageColorScale, default: keyframe length
  ageDomain:       [0, 100]

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


## layer states
Layer can have a display mode


## License
MIT License (MIT)

[npm-image]: https://badge.fury.io/js/leaflet-particle-dispersion.svg
[npm-url]: https://www.npmjs.com/package/leaflet-particle-dispersion
[npm-downloads-image]: https://img.shields.io/npm/dt/leaflet-particle-dispersion.svg