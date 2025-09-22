// main.js
import { Viewer, createWorldTerrainAsync, Cartesian3, Color, Ion, SceneMode, Cartographic, Math as CesiumMath, ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { AirspaceVisualizer } from './airspace-visualizer.js';
import { AirspaceUIControls } from './ui-controls.js';
import { AircraftTracker } from './aircraft-tracker.js';
import { AircraftUIControls } from './aircraft-ui-controls.js';
import { AirspaceViolationDetector } from './airspace-violation-detector.js';
import { SidebarUIControls } from './sidebar-ui-controls.js';

// (optional but recommended) set your Cesium ion token
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || "";

const viewer = new Viewer("cesiumContainer", {
  sceneMode: SceneMode.SCENE3D,
});

// Terrain setup will be handled in initializeAirspaceVisualization

// Initialize Visualization Systems
let airspaceVisualizer;
let airspaceControls;
let aircraftTracker;
let aircraftControls;
let violationDetector;
let sidebarControls;

async function initializeVisualizationSystem() {
  try {
    console.log('Initializing comprehensive visualization system...');

    // Create airspace visualizer
    airspaceVisualizer = new AirspaceVisualizer(viewer);

    // Load airspace data
    await airspaceVisualizer.loadAirspaceData('./data/airspace-slovenia.geojson');

    // Create aircraft tracker
    aircraftTracker = new AircraftTracker(viewer);

    // Create violation detector
    violationDetector = new AirspaceViolationDetector(airspaceVisualizer);

    // Create legacy UI controls (hidden by default)
    airspaceControls = new AirspaceUIControls(airspaceVisualizer);
    aircraftControls = new AircraftUIControls(aircraftTracker);

    // Create new unified sidebar
    sidebarControls = new SidebarUIControls(airspaceVisualizer, aircraftTracker);

    // Connect legacy controls to sidebar
    sidebarControls.setAirspaceControls(airspaceControls);
    sidebarControls.setAircraftControls(aircraftControls);

    // Hide original controls to avoid duplication
    sidebarControls.hideOriginalControls();

    // Make controls globally available for button callbacks
    window.airspaceControls = airspaceControls;
    window.aircraftControls = aircraftControls;
    window.sidebarControls = sidebarControls;

    // Setup aircraft tracking integration with violation detection
    aircraftTracker.onAircraftUpdate((event) => {
      if (event.type === 'data_updated') {
        // Check for airspace violations
        violationDetector.checkViolations(event.aircraft);
      }
    });

    // Setup violation alerts
    violationDetector.onViolationDetected((violation) => {
      console.warn('Airspace violation:', violation.getMessage());

      // Show violation in UI
      const violationMessage = document.createElement('div');
      violationMessage.className = 'violation-alert';
      violationMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(244, 67, 54, 0.9);
        color: white;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        max-width: 300px;
        z-index: 10000;
        border: 1px solid #d32f2f;
      `;
      violationMessage.innerHTML = `
        <strong>⚠️ AIRSPACE VIOLATION</strong><br>
        ${violation.getMessage()}<br>
        <small>${violation.timestamp.toLocaleTimeString()}</small>
      `;

      document.body.appendChild(violationMessage);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (violationMessage.parentNode) {
          violationMessage.parentNode.removeChild(violationMessage);
        }
      }, 10000);
    });

    violationDetector.onViolationResolved((violation) => {
      console.log('Airspace violation resolved:', violation.getMessage());
    });

    // Render initial airspaces
    airspaceVisualizer.renderAirspaces();

    // Update statistics
    airspaceControls.updateStats();
    sidebarControls.updateAirspaceStats();

    // Hide legacy aircraft controls (now handled by sidebar)
    aircraftControls.hide();

    console.log('Visualization system initialized successfully');

    // Set camera to Slovenia
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(14.5, 46.0, 500000), // Slovenia center
    });

  } catch (error) {
    console.error('Failed to initialize visualization system:', error);

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

// Initialize visualization system after terrain is loaded
createWorldTerrainAsync().then((terrainProvider) => {
  viewer.terrainProvider = terrainProvider;
  initializeVisualizationSystem();
});

// Remove the original terrain setup since it's now integrated above
// createWorldTerrainAsync().then((terrainProvider) => {
//   viewer.terrainProvider = terrainProvider;
// });

// Enhanced click handler with airspace and aircraft integration
const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction(function (click) {
  console.log('Click detected via Cesium event handler!');

  // First check if an aircraft was clicked
  if (aircraftTracker) {
    const aircraft = aircraftTracker.handleClick(click.position);
    if (aircraft) {
      // Aircraft was clicked, let the aircraft system handle it
      return;
    }
  }

  // Check if an airspace was clicked
  if (airspaceVisualizer) {
    const airspace = airspaceVisualizer.handleClick(click.position);
    if (airspace) {
      // Airspace was clicked, let the airspace system handle it
      return;
    }
  }

  // No aircraft or airspace clicked, proceed with terrain elevation display
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

// Add mouse hover handler for airspace and aircraft highlighting
handler.setInputAction(function (movement) {
  // Check aircraft hover first
  if (aircraftTracker) {
    const aircraft = aircraftTracker.handleHover(movement.endPosition);
    if (aircraft) {
      // Aircraft hovered, don't check airspace
      return;
    }
  }

  // Check airspace hover
  if (airspaceVisualizer) {
    airspaceVisualizer.handleHover(movement.endPosition);
  }
}, ScreenSpaceEventType.MOUSE_MOVE);
