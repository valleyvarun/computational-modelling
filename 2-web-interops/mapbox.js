// MapLibre GL map with 3D extrusions from a local GeoJSON file
// Expects a container with id "mapbox-container"
(function () {
  const containerId = 'mapbox-container'
  const container = document.getElementById(containerId)
  if (!container || typeof maplibregl === 'undefined') return

  // Dark basemap style (free, tokenless)
  const style = {
    version: 8,
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.9 },
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap, © CARTO'
      },
      labels: {
        type: 'raster',
        tiles: [
          'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
          'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap, © CARTO'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
          paint: { 'background-color': '#0e1428' }
      },
      {
        id: 'basemap-tiles',
        type: 'raster',
        source: 'basemap',
          paint: {
            'raster-opacity': 0.85,
            'raster-contrast': 0.3,
            'raster-brightness-min': 0.15,
            'raster-brightness-max': 0.95,
            'raster-saturation': 0.25
          }
      },
      {
        id: 'basemap-labels',
        type: 'raster',
        source: 'labels',
        paint: {
          'raster-opacity': 1.0,
          'raster-brightness-min': 0.6,
          'raster-brightness-max': 1.0,
          'raster-contrast': 0.5,
          'raster-saturation': 0
        }
      }
    ]
  }

  const map = new maplibregl.Map({
    container: containerId,
    style,
    center: [0, 0],
    zoom: 2,
    pitch: 48,
    bearing: -10,
    antialias: true
  })

  // Controls
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: 'metric' }))

  map.on('load', () => {
    // Add local GeoJSON source
    map.addSource('hia', {
      type: 'geojson',
      data: '2-web-interops/hia-mapbox.geojson'
    })

    // Fill-extrusion for 3D buildings/polygons
    map.addLayer({
      id: 'hia-extrusion',
      type: 'fill-extrusion',
      source: 'hia',
      filter: [
        'any',
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'MultiPolygon']
      ],
      paint: {
        // Uniform purple for all buildings
        'fill-extrusion-color': '#a855f7',
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'height']], 0],
        'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'base_height']], 0],
        'fill-extrusion-opacity': 1.0,
        'fill-extrusion-vertical-gradient': true
      }
    })

    // Also add 2D outlines for clarity
    map.addLayer({
      id: 'hia-outline',
      type: 'line',
      source: 'hia',
      paint: {
        'line-color': '#2a3140',
        'line-width': 1
      }
    })

    // Roads (generic polylines)
  map.addLayer({
      id: 'hia-roads',
      type: 'line',
      source: 'hia',
      filter: [
        'any',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['geometry-type'], 'MultiLineString']
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
    'line-color': ['case', ['has', 'road_color'], ['get', 'road_color'], '#94a3b8'],
    'line-opacity': 1.0,
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 2.8, 16, 5, 18, 8]
      }
    })

    // Site boundary (highlighted)
  map.addLayer({
      id: 'hia-site-boundary',
      type: 'line',
      source: 'hia',
      filter: [
        'all',
        [
          'any',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['geometry-type'], 'MultiLineString']
        ],
        [
          'any',
          ['==', ['get', 'type'], 'site'],
          ['==', ['get', 'category'], 'site'],
          ['==', ['get', 'category'], 'site_boundary'],
          ['==', ['get', 'role'], 'site_boundary'],
          ['==', ['get', 'site'], true],
          ['==', ['get', 'is_site'], true],
          ['==', ['get', 'site'], 1],
          ['==', ['get', 'is_site'], 1]
        ]
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
    'line-color': '#1d4ed8',
    'line-opacity': 1.0,
    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 16, 8, 18, 12]
      }
    })

    // Fit map to data bounds
    try {
      fetch('2-web-interops/hia-mapbox.geojson')
        .then(r => r.json())
        .then(geo => {
          const b = bbox(geo)
          if (b) map.fitBounds(b, { padding: 40, duration: 900 })
        })
    } catch {}

    // Interactivity: show popup with name on building click
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true })
    map.on('mouseenter', 'hia-extrusion', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'hia-extrusion', () => { map.getCanvas().style.cursor = '' })
    map.on('click', 'hia-extrusion', (e) => {
      const f = e.features && e.features[0]
      if (!f) return
      const props = f.properties || {}
      const name = props.name || props.Name || props.title || 'Building'
    const h = Number(props.height) || 0
    const html = `<div style="font:600 12px system-ui; margin-bottom:2px; color:#000;">${name}</div>` +
         `<div style="font:12px system-ui; color:#000; opacity:.85;">Height: ${h} m</div>`
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map)
    })
  })

  // Minimal bbox calc (no turf dependency)
  function bbox(geo) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const push = (c) => {
      minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1])
      maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1])
    }
    const walk = (coords) => {
      if (typeof coords[0] === 'number') { push(coords); return }
      for (const c of coords) walk(c)
    }
    const feats = geo.type === 'FeatureCollection' ? geo.features : [geo]
    for (const f of feats) {
      const g = f.type === 'Feature' ? f.geometry : f
      if (!g) continue
      walk(g.coordinates)
    }
    if (minX === Infinity) return null
    return [ [minX, minY], [maxX, maxY] ]
  }
})()
