import {
  Entity,
  PolygonGraphics,
  LabelGraphics,
  Cartesian3,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  Cartesian2,
  Cartographic,
  Math as CesiumMath,
} from "cesium";
import { AirspaceDataProcessor } from "./data-processor.js";
import { AirspaceClassifier } from "./airspace-classifier.js";

export class AirspaceVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.airspaces = [];
    this.entities = new Map();
    this.showLabels = true;
    this.showPolygons = true; // Toggle for airspace polygon visibility
    this.maxAltitudeFilter = 20000; // 20km default
    this.highlightedAirspace = null;

    this.eventHandlers = {
      onAirspaceClick: null,
      onAirspaceHover: null,
    };
  }

  async loadAirspaceData(geoJsonUrl) {
    try {
      const response = await fetch(geoJsonUrl);
      if (!response.ok) {
        throw new Error(`Failed to load airspace data: ${response.statusText}`);
      }

      const geoJsonData = await response.json();
      this.airspaces = AirspaceDataProcessor.processGeoJSON(geoJsonData);

      console.log(`Loaded ${this.airspaces.length} airspaces`);
      return this.airspaces;
    } catch (error) {
      console.error("Error loading airspace data:", error);
      throw error;
    }
  }

  createAirspaceEntity(airspace) {
    const style = AirspaceClassifier.getVisualizationStyle(airspace, {
      highlighted: false,
      showLabels: this.showLabels,
    });

    // Debug: Log the color being applied
    console.log(`Airspace ${airspace.name} (class ${airspace.icaoClass}):`, {
      fillColor: style.fillColor,
      outlineColor: style.outlineColor,
    });

    const heights = AirspaceDataProcessor.getAirspaceHeight(airspace);

    const positions = airspace.coordinates.map((coord) =>
      Cartesian3.fromDegrees(coord[0], coord[1])
    );

    // Calculate polygon centroid for label positioning
    const centroid = this.calculatePolygonCentroid(positions);
    const labelHeight = (heights.bottom + heights.top) / 2; // Mid-point altitude
    const labelPosition = Cartesian3.fromDegrees(
      centroid.longitude,
      centroid.latitude,
      labelHeight
    );

    // Check camera distance for debugging
    const cameraHeight = this.viewer.camera.positionCartographic.height;
    const distanceToLabel = Cartesian3.distance(
      this.viewer.camera.position,
      labelPosition
    );

    console.log(`Creating entity for ${airspace.name}:`, {
      showLabel: style.showLabel,
      centroid: centroid,
      labelHeight: labelHeight,
      labelText: style.labelText,
      cameraHeight: cameraHeight,
      distanceToLabel: distanceToLabel,
    });

    const entity = new Entity({
      id: `airspace_${airspace.id}`,
      name: airspace.name,
      position: labelPosition, // Explicit position for label
      polygon: new PolygonGraphics({
        hierarchy: positions,
        height: heights.bottom,
        extrudedHeight: heights.top,
        fill: style.fill,
        material: style.fillColor,
        outline: style.outline,
        outlineColor: style.outlineColor,
        outlineWidth: style.outlineWidth,
        show: this.showPolygons, // Respect polygon visibility toggle
      }),
      label: style.showLabel
        ? new LabelGraphics({
            text: style.labelText,
            font: "14pt sans-serif", // Even larger font
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 4, // Thicker outline for visibility
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cartesian2(0, 0), // No offset for testing
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            // Temporarily remove scale restrictions to test visibility
            // scaleByDistance: new Cartesian3(10000, 1.5, 500000, 0.5),
            // disableDepthTestDistance: Number.POSITIVE_INFINITY, // Always visible
            show: true,
          })
        : undefined,
    });

    console.log(`Entity created with label:`, entity.label ? "YES" : "NO");

    entity.airspaceData = airspace;
    entity.airspaceStyle = style;

    return entity;
  }

  calculatePolygonCentroid(positions) {
    // Calculate centroid of polygon from Cartesian3 positions
    let totalLat = 0;
    let totalLon = 0;

    positions.forEach((position) => {
      const cartographic = Cartographic.fromCartesian(position);
      totalLat += CesiumMath.toDegrees(cartographic.latitude);
      totalLon += CesiumMath.toDegrees(cartographic.longitude);
    });

    return {
      latitude: totalLat / positions.length,
      longitude: totalLon / positions.length,
    };
  }

  renderAirspaces() {
    this.clearAirspaces();

    const filteredAirspaces = AirspaceClassifier.filterByAltitude(
      this.airspaces,
      this.maxAltitudeFilter
    );

    filteredAirspaces.forEach((airspace) => {
      const entity = this.createAirspaceEntity(airspace);
      this.viewer.entities.add(entity);
      this.entities.set(airspace.id, entity);
    });

    console.log(
      `Rendered ${filteredAirspaces.length} airspaces (filtered from ${this.airspaces.length})`
    );
  }

  clearAirspaces() {
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.entities.clear();
  }

  setAltitudeFilter(maxAltitude) {
    this.maxAltitudeFilter = maxAltitude;
    this.renderAirspaces();
  }

  setShowLabels(show) {
    this.showLabels = show;

    // Re-render all airspaces to ensure labels are created/removed properly
    this.renderAirspaces();
  }

  setShowPolygons(show) {
    this.showPolygons = show;

    // Update visibility of all existing polygon entities
    this.entities.forEach(entity => {
      if (entity.polygon) {
        entity.polygon.show = show;
      }
    });

    console.log(`[AirspaceVisualizer] Airspace polygons: ${show ? 'visible' : 'hidden'}`);
  }

  highlightAirspace(airspaceId, highlight = true) {
    if (this.highlightedAirspace && this.highlightedAirspace !== airspaceId) {
      this.unhighlightAirspace(this.highlightedAirspace);
    }

    const entity = this.entities.get(airspaceId);
    if (!entity) return;

    const airspace = entity.airspaceData;
    const style = AirspaceClassifier.getVisualizationStyle(airspace, {
      highlighted: highlight,
      showLabels: this.showLabels,
    });

    entity.polygon.fillColor = style.fillColor;
    entity.polygon.outlineColor = style.outlineColor;
    entity.polygon.outlineWidth = style.outlineWidth;

    if (highlight) {
      this.highlightedAirspace = airspaceId;
    }
  }

  unhighlightAirspace(airspaceId) {
    if (this.highlightedAirspace === airspaceId) {
      this.highlightedAirspace = null;
    }

    this.highlightAirspace(airspaceId, false);
  }

  getAirspaceAtPosition(position) {
    const pickedObject = this.viewer.scene.pick(position);

    if (pickedObject && pickedObject.id && pickedObject.id.airspaceData) {
      return pickedObject.id.airspaceData;
    }

    return null;
  }

  focusOnAirspace(airspaceId) {
    const entity = this.entities.get(airspaceId);
    if (!entity) return;

    this.viewer.zoomTo(entity);
    this.highlightAirspace(airspaceId);
  }

  getVisibleAirspaces() {
    const camera = this.viewer.camera;
    const visibleAirspaces = [];

    this.entities.forEach((entity, airspaceId) => {
      if (entity.isShowing) {
        visibleAirspaces.push(entity.airspaceData);
      }
    });

    return visibleAirspaces;
  }

  getStatistics() {
    const stats = {
      total: this.airspaces.length,
      visible: this.entities.size,
      byClass: {},
    };

    this.airspaces.forEach((airspace) => {
      const className = AirspaceClassifier.getClassificationInfo(
        airspace.icaoClass
      ).name;
      stats.byClass[className] = (stats.byClass[className] || 0) + 1;
    });

    return stats;
  }

  onAirspaceClick(callback) {
    this.eventHandlers.onAirspaceClick = callback;
  }

  onAirspaceHover(callback) {
    this.eventHandlers.onAirspaceHover = callback;
  }

  handleClick(position) {
    const airspace = this.getAirspaceAtPosition(position);

    if (airspace && this.eventHandlers.onAirspaceClick) {
      this.eventHandlers.onAirspaceClick(airspace, position);
    }

    return airspace;
  }

  handleHover(position) {
    const airspace = this.getAirspaceAtPosition(position);

    if (this.eventHandlers.onAirspaceHover) {
      this.eventHandlers.onAirspaceHover(airspace, position);
    }

    return airspace;
  }

  destroy() {
    this.clearAirspaces();
    this.airspaces = [];
    this.eventHandlers = {};
  }
}
