// main.js
import { Viewer, createWorldTerrainAsync, Cartesian3, Color, Ion, SceneMode, Cartographic, Math as CesiumMath, ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { AirspaceVisualizer } from './airspace-visualizer.js';
import { AirspaceUIControls } from './ui-controls.js';

// (optional but recommended) set your Cesium ion token
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || "";

const viewer = new Viewer("cesiumContainer", {
  sceneMode: SceneMode.SCENE3D,
});

// Terrain setup will be handled in initializeAirspaceVisualization

// Initialize Airspace Visualization
let airspaceVisualizer;
let airspaceControls;

async function initializeAirspaceVisualization() {
  try {
    // Create airspace visualizer
    airspaceVisualizer = new AirspaceVisualizer(viewer);
    
    // Load airspace data
    await airspaceVisualizer.loadAirspaceData('./data/airspace-slovenia.geojson');
    
    // Create UI controls
    airspaceControls = new AirspaceUIControls(airspaceVisualizer);
    
    // Make controls globally available for button callbacks
    window.airspaceControls = airspaceControls;
    
    // Render initial airspaces
    airspaceVisualizer.renderAirspaces();
    
    // Update statistics
    airspaceControls.updateStats();
    
    console.log('Airspace visualization initialized successfully');
    
    // Set camera to Slovenia
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(14.5, 46.0, 500000), // Slovenia center
    });
    
  } catch (error) {
    console.error('Failed to initialize airspace visualization:', error);
    
    // Fallback to original setup
    viewer.entities.add({
      name: "UAV",
      position: Cartesian3.fromDegrees(-74.0, 40.7, 3000),
      point: { pixelSize: 10, color: Color.RED },
    });

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-74.0, 40.7, 20000000),
    });
  }
}

// Initialize airspace visualization after terrain is loaded
createWorldTerrainAsync().then((terrainProvider) => {
  viewer.terrainProvider = terrainProvider;
  initializeAirspaceVisualization();
});

// Remove the original terrain setup since it's now integrated above
// createWorldTerrainAsync().then((terrainProvider) => {
//   viewer.terrainProvider = terrainProvider;
// });

// Enhanced click handler with airspace integration
const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function (click) {
  console.log('Click detected via Cesium event handler!');
  
  // First check if an airspace was clicked
  if (airspaceVisualizer) {
    const airspace = airspaceVisualizer.handleClick(click.position);
    if (airspace) {
      // Airspace was clicked, let the airspace system handle it
      return;
    }
  }
  
  // No airspace clicked, proceed with terrain elevation display
  const pickedPosition = viewer.scene.pickPosition(click.position);
  
  if (pickedPosition) {
    // Direct terrain pick worked
    const cartographic = Cartographic.fromCartesian(pickedPosition);
    const longitude = CesiumMath.toDegrees(cartographic.longitude);
    const latitude = CesiumMath.toDegrees(cartographic.latitude);
    const height = cartographic.height;
    
    console.log(`Direct pick - Height: ${height.toFixed(2)} meters`);
    
    const elevationDiv = document.getElementById('elevationInfo');
    if (elevationDiv) {
      elevationDiv.innerHTML = `
        <strong>Elevation Data:</strong><br>
        Lat: ${latitude.toFixed(6)}°<br>
        Lon: ${longitude.toFixed(6)}°<br>
        Height: ${height.toFixed(2)} m
      `;
    }
  } else {
    // Fallback to globe intersection
    console.log('Direct pick failed, using globe intersection');
    const ray = viewer.scene.camera.getPickRay(click.position);
    const intersection = viewer.scene.globe.pick(ray, viewer.scene);
    
    if (intersection) {
      const cartographic = Cartographic.fromCartesian(intersection);
      const longitude = CesiumMath.toDegrees(cartographic.longitude);
      const latitude = CesiumMath.toDegrees(cartographic.latitude);
      
      // Sample terrain at this position
      viewer.terrainProvider.sampleTerrainMostDetailed([cartographic]).then(function(results) {
        if (results && results.length > 0 && results[0].height !== undefined) {
          const height = results[0].height;
          console.log(`Sampled terrain height: ${height.toFixed(2)} meters`);
          
          const elevationDiv = document.getElementById('elevationInfo');
          if (elevationDiv) {
            elevationDiv.innerHTML = `
              <strong>Elevation Data:</strong><br>
              Lat: ${latitude.toFixed(6)}°<br>
              Lon: ${longitude.toFixed(6)}°<br>
              Height: ${height.toFixed(2)} m
            `;
          }
        } else {
          console.log('No terrain height available');
          const elevationDiv = document.getElementById('elevationInfo');
          if (elevationDiv) {
            elevationDiv.innerHTML = 'No elevation data available at this location';
          }
        }
      }).catch(function(error) {
        console.error('Error sampling terrain:', error);
      });
    }
  }
}, ScreenSpaceEventType.LEFT_CLICK);

// Add mouse hover handler for airspace highlighting
handler.setInputAction(function (movement) {
  if (airspaceVisualizer) {
    airspaceVisualizer.handleHover(movement.endPosition);
  }
}, ScreenSpaceEventType.MOUSE_MOVE);
