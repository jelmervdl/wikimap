document.addEventListener('DOMContentLoaded', function() {
	const container = document.getElementById('map');
	mapboxgl.accessToken = container.dataset.mapboxAccessToken;

	const map = new mapboxgl.Map({
		container: 'map',
		style: 'mapbox://styles/mapbox/streets-v11',
		center: [6.56, 53.22],
		zoom: 14
	});

	map.addControl(new mapboxgl.NavigationControl());

	const known = new Set();
	const features = [];

	async function fetchData() {
		const bounds = map.getBounds();
		const center = bounds.getCenter();
		const radius = 5000;
		const limit = 500;
		const url = `https://nl.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=geosearch&gsprimary=all&gsradius=${radius}&gscoord=${center.lat}|${center.lng}&gslimit=${limit}`;
		
		const response = await fetch(url, {credentials: 'omit'});

		const data = await response.json();

		const unknown = data.query.geosearch
			.filter(article => !known.has(article.pageid))
			.map(article => ({
				'type': 'Feature',
				'geometry': {
					'type': 'Point',
					'coordinates': [article.lon, article.lat],
				},
				'properties': {
					'pageid': article.pageid,
					'title':  article.title
				}
			}));

		if (!unknown.length)
			return;
				
		unknown.forEach(article => known.add(article.properties.pageid));
		features.push(...unknown);

		console.log({
			'type': 'FeatureCollection',
			'features': features
		});
		
		map.getSource('wikipedia').setData({
			'type': 'FeatureCollection',
			'features': features
		});
	}

	map.on('load', () => {
		map.addSource('wikipedia', {
			'type': 'geojson',
			'data': {
				'type': 'FeatureCollection',
				'features': []
			},
			'cluster': true,
			'clusterMaxZoom': 13, // Max zoom to cluster points on
			'clusterRadius': 50 // Radius of each cluster when clustering points (defaults to 50)
		});

		map.addLayer({
			id: 'clusters',
			type: 'circle',
			source: 'wikipedia',
			filter: ['has', 'point_count'],
			paint: {
				// Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
				// with three steps to implement three types of circles:
				//   * Blue, 20px circles when point count is less than 100
				//   * Yellow, 30px circles when point count is between 100 and 750
				//   * Pink, 40px circles when point count is greater than or equal to 750
				'circle-color': [
					'step',
					['get', 'point_count'],
						    '#51bbd6',
						 5, '#f1f075',
						20, '#f28cb1'
				],
				'circle-radius': [
					'step',
					['get', 'point_count'],
						    10, 
						 5, 13, 
						20, 20
				]
			}
		});
			 
		map.addLayer({
			id: 'cluster-count',
			type: 'symbol',
			source: 'wikipedia',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': '{point_count_abbreviated}',
				'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
				'text-size': 12
			}
		});
		 
		map.addLayer({
			id: 'unclustered-point',
			type: 'circle',
			source: 'wikipedia',
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-color': '#11b4da',
				'circle-radius': 4,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#fff'
			}
		});

		map.addLayer({
			id: 'unclustered-point-labels',
			type: 'symbol',
			source: 'wikipedia',
			filter: ['!', ['has', 'point_count']],
			paint: {
				'text-field': ['get', 'title'],
				'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
				'text-size': 12
			}
		});
	});

	map.on('load', fetchData);
	map.on('moveend', fetchData);
});