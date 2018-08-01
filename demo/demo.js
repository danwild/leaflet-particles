
$(document).ready(function () {

	var keys = Object.keys(data);
	var stepCount = keys.length;
	var firstFrame = data[keys[0]];
	var firstParticle = firstFrame[0];
	console.log(firstParticle);
	var map = L.map('map').setView([ firstParticle[1], firstParticle[0] ], 8);

	console.log(data);
	console.log('frame count ' + stepCount);

	L.tileLayer("http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png")
		.addTo(map);

	var particleLayer = L.particleDispersionLayer({
		data: data,
		//dataFormat: {
		//	idIndex:    0,
		//	lonIndex:   0,
		//	latIndex:   1,
		//	depthIndex: 2,
		//	ageIndex:   0
		//},
		startFrameIndex: 10,
		ageColorScale: ['green', 'yellow', 'red'],
		ageDomain: [0, stepCount],
		heatOptions: {
			radius: 20,
			fixedRadius: false,
			radiusMeters: 500,
			heatBin: {
				enabled: true,
				cellSizeKm: 0.25,
				maxFactor: 0.1,
				showBinGrid: false
			},
			useLocalExtrema: true,
			onExtremaChange: function(data) {
				console.log(data);
			}
			//gradient: {0.4: 'blue', 0.65: 'green', 1: 'red'}
		}
	});

	var layerControl = L.control.layers({}, {particles: particleLayer});
	layerControl.addTo(map);
	particleLayer.addTo(map);

	$('input[type=radio][name=displayMode]').change(function(){

		console.log(`change ${this.value}`);
		particleLayer.setDisplayMode(this.value);

		if (this.value === 'KEYFRAME') {
			$('.slidecontainer').show();
			$('#keyFrameSlider').on('input', keyFrameHandler);
		} else {
			$('.slidecontainer').hide();
			$('#keyFrameSlider').off('input', keyFrameHandler);
		}
	});

	$('#getLatLngBounds').click(() => {
		console.log(particleLayer.getLatLngBounds());
	});

	var keyFrameHandler = function(){
		particleLayer.setFrameIndex(+this.value);
	};

	$('#keyFrameSlider').prop('max', stepCount - 1);


});