// aircraft-visualizer.js
// Aircraft visualization and rendering system for Cesium

import {
  Entity,
  BillboardGraphics,
  LabelGraphics,
  PolylineGraphics,
  PlaneGraphics,
  ModelGraphics,
  BoxGraphics,
  Cartesian3,
  Cartesian2,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  HeightReference,
  ClassificationType,
  DistanceDisplayCondition,
  Transforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ImageMaterialProperty,
  Plane,
  HeadingPitchRoll,
  Matrix3,
  Quaternion,
} from "cesium";

import { AircraftClassifier } from "./aircraft-classifier.js";
import { ProcessedAircraft, AircraftConfig } from "./aircraft-types.js";
import { aircraftIconManager } from "./aircraft-icon-manager.js";

/**
 * Aircraft visualization system for Cesium viewer
 * Manages aircraft entities, trails, labels, and visual effects
 */
export class AircraftVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.aircraft = new Map(); // Map of icao24 -> ProcessedAircraft
    this.entities = new Map(); // Map of icao24 -> Cesium Entity
    this.trailEntities = new Map(); // Map of icao24 -> Trail Entity

    // Visualization settings
    this.showLabels = AircraftConfig.showLabels;
    this.showTrails = AircraftConfig.showTrails;
    this.lodEnabled = true;

    // Filters
    this.enabledTypes = AircraftConfig.enabledTypes.slice();
    this.altitudeFilter = { ...AircraftConfig.altitudeFilter };
    this.speedFilter = { ...AircraftConfig.speedFilter };
    this.activeOnly = true;

    // Hover state tracking
    this.currentlyHighlighted = null;

    // Event handlers
    this.eventHandlers = {
      onAircraftClick: null,
      onAircraftHover: null,
    };

    // Performance tracking
    this.renderCount = 0;
    this.lastRenderTime = 0;

    // Set up Cesium click handlers
    this.setupClickHandlers();

    // Initialize icon manager
    this.initializeIconManager();

    console.log("Aircraft Visualizer initialized");
  }

  /**
   * Add or update aircraft in the visualization
   * @param {ProcessedAircraft[]} aircraftList - Array of processed aircraft
   */
  async updateAircraft(aircraftList) {
    const startTime = performance.now();
    let added = 0,
      updated = 0,
      removed = 0;

    // Track current aircraft IDs
    const currentIds = new Set(aircraftList.map((a) => a.icao24));
    const existingIds = new Set(this.aircraft.keys());

    // Remove aircraft no longer present
    for (const icao24 of existingIds) {
      if (!currentIds.has(icao24)) {
        this.removeAircraft(icao24);
        removed++;
      }
    }

    // Add or update aircraft (process all operations in parallel for better performance)
    const updatePromises = [];
    for (const aircraft of aircraftList) {
      const existing = this.aircraft.get(aircraft.icao24);

      if (existing) {
        updatePromises.push(this.updateAircraftEntity(aircraft));
        updated++;
      } else {
        updatePromises.push(this.addAircraft(aircraft));
        added++;
      }
    }

    // Wait for all operations to complete
    await Promise.all(updatePromises);

    // Update render stats
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;

    console.log(
      `Aircraft update: +${added} ~${updated} -${removed} (${this.lastRenderTime.toFixed(
        1
      )}ms)`
    );
  }

  /**
   * Add new aircraft to visualization
   * @param {ProcessedAircraft} aircraft - Processed aircraft data
   */
  async addAircraft(aircraft) {
    if (!this.shouldShowAircraft(aircraft)) {
      return;
    }

    this.aircraft.set(aircraft.icao24, aircraft);

    // Create main aircraft entity asynchronously
    const entity = await this.createAircraftEntity(aircraft);
    this.viewer.entities.add(entity);
    this.entities.set(aircraft.icao24, entity);

    // Create trail entity if enabled
    if (this.showTrails && aircraft.trail.length > 1) {
      const trailEntity = this.createTrailEntity(aircraft);
      this.viewer.entities.add(trailEntity);
      this.trailEntities.set(aircraft.icao24, trailEntity);
    }
  }

  /**
   * Remove aircraft from visualization
   * @param {string} icao24 - Aircraft identifier
   */
  removeAircraft(icao24) {
    // Remove main entity
    const entity = this.entities.get(icao24);
    if (entity) {
      this.viewer.entities.remove(entity);
      this.entities.delete(icao24);
    }

    // Remove trail entity
    const trailEntity = this.trailEntities.get(icao24);
    if (trailEntity) {
      this.viewer.entities.remove(trailEntity);
      this.trailEntities.delete(icao24);
    }

    // Clear highlight if this was the highlighted aircraft
    const aircraft = this.aircraft.get(icao24);
    if (aircraft && this.currentlyHighlighted === aircraft) {
      this.currentlyHighlighted = null;
    }

    // Remove from tracking
    this.aircraft.delete(icao24);
  }

  /**
   * Update existing aircraft entity
   * @param {ProcessedAircraft} aircraft - Updated aircraft data
   */
  async updateAircraftEntity(aircraft) {
    if (!this.shouldShowAircraft(aircraft)) {
      this.removeAircraft(aircraft.icao24);
      return;
    }

    const entity = this.entities.get(aircraft.icao24);
    if (!entity) {
      await this.addAircraft(aircraft);
      return;
    }

    // Update aircraft data
    this.aircraft.set(aircraft.icao24, aircraft);

    // Update position
    const position = Cartesian3.fromDegrees(
      aircraft.longitude,
      aircraft.latitude,
      aircraft.getAltitude() || 0
    );
    entity.position = position;

    // Update orientation if heading is available
    if (aircraft.trueTrack !== null) {
      entity.orientation = this.calculateOrientation(aircraft);
    }

    // Update visual style
    const style = AircraftClassifier.getVisualizationStyle(aircraft, {
      highlighted: aircraft.isHighlighted,
      selected: aircraft.isSelected,
      showLabels: this.showLabels,
      lod: this.determineLOD(aircraft),
    });

    this.updateEntityStyle(entity, style);

    // Update trail
    if (this.showTrails) {
      this.updateTrail(aircraft);
    } else {
      this.removeTrail(aircraft.icao24);
    }
  }

  /**
   * Create Cesium entity for aircraft
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {Promise<Entity>} Cesium entity
   */
  async createAircraftEntity(aircraft) {
    const position = Cartesian3.fromDegrees(
      aircraft.longitude,
      aircraft.latitude,
      aircraft.getAltitude() || 0
    );

    const style = AircraftClassifier.getVisualizationStyle(aircraft, {
      highlighted: aircraft.isHighlighted,
      selected: aircraft.isSelected,
      showLabels: this.showLabels,
      lod: this.determineLOD(aircraft),
    });

    // Calculate aircraft orientation based on heading
    // Add 180-degree rotation to correct model orientation
    const heading = aircraft.trueTrack
      ? (aircraft.trueTrack * Math.PI) / 180 + Math.PI
      : Math.PI;
    const pitch = 0; // Keep aircraft level
    const roll = 0; // No roll
    const hpr = new HeadingPitchRoll(heading, pitch, roll);
    const orientation = Transforms.headingPitchRollQuaternion(position, hpr);

    // Calculate model scale based on aircraft type
    const modelScale = Math.max(10, style.size * 5); // Scale factor

    const entity = new Entity({
      id: `aircraft_${aircraft.icao24}`,
      name: aircraft.callsign || aircraft.icao24,
      position: position,
      orientation: orientation, // 3D orientation for heading
      icao24: aircraft.icao24, // Add icao24 property for click identification

      // 3D Aircraft Model
      model: new ModelGraphics({
        uri: "./assets/airliner.glb",
        scale: Math.max(15, style.size * 7.5), // Scale based on aircraft type (50% bigger)
        show: true,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 2000000),
        color: style.fillColor,
        colorBlendMode: 0, // Mix color with model
        colorBlendAmount: 0.3, // Blend amount (0-1)
      }),

      // Label for aircraft information
      label: style.showLabel
        ? new LabelGraphics({
            text: style.labelText,
            font: style.labelStyle.font,
            fillColor: style.labelStyle.fillColor,
            outlineColor: style.labelStyle.outlineColor,
            outlineWidth: style.labelStyle.outlineWidth,
            style: style.labelStyle.style,
            pixelOffset: style.labelStyle.pixelOffset,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            heightReference: HeightReference.NONE,
            show: true,
            scale: style.labelStyle.scale,
            showBackground: style.labelStyle.showBackground,
            backgroundColor: style.labelStyle.backgroundColor,
            backgroundPadding: style.labelStyle.backgroundPadding,
            distanceDisplayCondition: new DistanceDisplayCondition(0, 500000), // 500km max label distance
          })
        : undefined,
    });

    // Set orientation if heading is available
    if (aircraft.trueTrack !== null) {
      entity.orientation = this.calculateOrientation(aircraft);
    }

    // Attach aircraft data for event handling
    entity.aircraftData = aircraft;

    return entity;
  }

  /**
   * Create trail entity for aircraft flight path
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {Entity} Trail entity
   */
  createTrailEntity(aircraft) {
    if (aircraft.trail.length < 2) {
      return null;
    }

    const positions = aircraft.trail.map((pos) =>
      Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude || 0)
    );

    const style = AircraftClassifier.getVisualizationStyle(aircraft);

    const entity = new Entity({
      id: `trail_${aircraft.icao24}`,
      name: `${aircraft.callsign || aircraft.icao24} Trail`,
      polyline: new PolylineGraphics({
        positions: positions,
        width: style.trailWidth,
        material: style.trailColor,
        clampToGround: false,
        show: true,
        classificationType: ClassificationType.NONE,
      }),
    });

    return entity;
  }

  /**
   * Update aircraft trail visualization
   * @param {ProcessedAircraft} aircraft - Aircraft data
   */
  updateTrail(aircraft) {
    if (!this.showTrails || aircraft.trail.length < 2) {
      this.removeTrail(aircraft.icao24);
      return;
    }

    let trailEntity = this.trailEntities.get(aircraft.icao24);

    if (!trailEntity) {
      trailEntity = this.createTrailEntity(aircraft);
      if (trailEntity) {
        this.viewer.entities.add(trailEntity);
        this.trailEntities.set(aircraft.icao24, trailEntity);
      }
      return;
    }

    // Update trail positions
    const positions = aircraft.trail.map((pos) =>
      Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude || 0)
    );

    trailEntity.polyline.positions = positions;

    // Update trail color if aircraft style changed
    const style = AircraftClassifier.getVisualizationStyle(aircraft);
    trailEntity.polyline.material = style.trailColor;
  }

  /**
   * Remove trail for aircraft
   * @param {string} icao24 - Aircraft identifier
   */
  removeTrail(icao24) {
    const trailEntity = this.trailEntities.get(icao24);
    if (trailEntity) {
      this.viewer.entities.remove(trailEntity);
      this.trailEntities.delete(icao24);
    }
  }

  /**
   * Initialize icon manager and preload icons
   */
  async initializeIconManager() {
    try {
      await aircraftIconManager.preloadIcons();
      console.log("Aircraft icons preloaded successfully");
    } catch (error) {
      console.error("Failed to initialize aircraft icons:", error);
    }
  }

  /**
   * Create aircraft icon using SVG system
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {Promise<string>} SVG data URL
   */
  async createAircraftIcon(aircraft) {
    try {
      const iconUrl = await aircraftIconManager.getAircraftIcon(aircraft, {
        color: aircraft.aircraftType.color,
        size: 80, // Match SVG viewBox size to avoid scaling issues
        rotation: 0, // No SVG rotation - handled by Billboard
      });

      return iconUrl;
    } catch (error) {
      console.error("Error creating aircraft icon:", error);
      // Fallback to simple canvas icon
      return this.createFallbackIcon(aircraft);
    }
  }

  /**
   * Create fallback canvas icon if SVG fails
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {string} Canvas data URL
   */
  createFallbackIcon(aircraft) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);

    // Draw aircraft icon (simplified)
    ctx.fillStyle = aircraft.aircraftType.color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    // Draw arrow-like aircraft shape
    ctx.beginPath();
    ctx.moveTo(16, 4); // nose
    ctx.lineTo(10, 20); // left wing
    ctx.lineTo(12, 24); // left tail
    ctx.lineTo(16, 22); // center tail
    ctx.lineTo(20, 24); // right tail
    ctx.lineTo(22, 20); // right wing
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Add status indicator for on-ground aircraft
    if (aircraft.onGround) {
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(26, 6, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    return canvas.toDataURL();
  }

  /**
   * Calculate aircraft orientation based on heading
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {Object} Cesium orientation
   */
  calculateOrientation(aircraft) {
    // Convert heading to radians and create rotation
    const heading = ((aircraft.trueTrack || 0) * Math.PI) / 180;
    const pitch = 0;
    const roll = 0;

    return Transforms.headingPitchRollQuaternion(
      Cartesian3.fromDegrees(
        aircraft.longitude,
        aircraft.latitude,
        aircraft.getAltitude() || 0
      ),
      { heading, pitch, roll }
    );
  }

  /**
   * Update entity visual style
   * @param {Entity} entity - Cesium entity
   * @param {Object} style - Style object
   */
  updateEntityStyle(entity, style) {
    if (entity.billboard) {
      entity.billboard.color = style.fillColor;
      entity.billboard.outlineColor = style.outlineColor;
      entity.billboard.outlineWidth = style.outlineWidth;
      entity.billboard.pixelSize = style.size;
    }

    if (entity.label) {
      entity.label.text = style.labelText;
      entity.label.font = style.labelStyle.font;
      entity.label.scale = style.labelStyle.scale;
      entity.label.show = style.showLabel;
      entity.label.showBackground = style.labelStyle.showBackground;
      entity.label.backgroundColor = style.labelStyle.backgroundColor;
    }
  }

  /**
   * Determine Level of Detail for aircraft
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {string} LOD level ('high' or 'low')
   */
  determineLOD(aircraft) {
    if (!this.lodEnabled) return "high";

    const cameraPosition = this.viewer.camera.position;
    const aircraftPosition = Cartesian3.fromDegrees(
      aircraft.longitude,
      aircraft.latitude,
      aircraft.getAltitude() || 0
    );

    const distance = Cartesian3.distance(cameraPosition, aircraftPosition);

    return distance > AircraftConfig.lod.high ? "low" : "high";
  }

  /**
   * Check if aircraft should be displayed based on filters
   * @param {ProcessedAircraft} aircraft - Aircraft data
   * @returns {boolean} Whether to show aircraft
   */
  shouldShowAircraft(aircraft) {
    // Active filter
    if (this.activeOnly && !aircraft.isActive()) {
      return false;
    }

    // Type filter
    if (
      !this.enabledTypes.includes("all") &&
      !this.enabledTypes.includes(aircraft.aircraftType.id)
    ) {
      return false;
    }

    // Altitude filter
    if (aircraft.altitudeFeet !== null) {
      if (
        aircraft.altitudeFeet < this.altitudeFilter.min ||
        aircraft.altitudeFeet > this.altitudeFilter.max
      ) {
        return false;
      }
    }

    // Speed filter
    if (aircraft.speedKnots !== null) {
      if (
        aircraft.speedKnots < this.speedFilter.min ||
        aircraft.speedKnots > this.speedFilter.max
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Set visibility filters
   */
  setFilters(filters) {
    const { types, altitudeRange, speedRange, activeOnly } = filters;

    if (types !== undefined) this.enabledTypes = types;
    if (altitudeRange !== undefined) this.altitudeFilter = altitudeRange;
    if (speedRange !== undefined) this.speedFilter = speedRange;
    if (activeOnly !== undefined) this.activeOnly = activeOnly;

    this.refreshVisibility();
  }

  /**
   * Refresh visibility of all aircraft based on current filters
   */
  refreshVisibility() {
    for (const [icao24, aircraft] of this.aircraft) {
      const entity = this.entities.get(icao24);
      if (entity) {
        const shouldShow = this.shouldShowAircraft(aircraft);
        entity.show = shouldShow;

        const trailEntity = this.trailEntities.get(icao24);
        if (trailEntity) {
          trailEntity.show = shouldShow && this.showTrails;
        }
      }
    }
  }

  /**
   * Toggle label visibility
   */
  setShowLabels(show) {
    this.showLabels = show;

    for (const entity of this.entities.values()) {
      if (entity.label) {
        entity.label.show = show;
      }
    }
  }

  /**
   * Toggle trail visibility
   */
  setShowTrails(show) {
    this.showTrails = show;

    if (show) {
      // Show existing trails and create missing ones
      for (const [icao24, aircraft] of this.aircraft) {
        this.updateTrail(aircraft);
      }
    } else {
      // Hide all trails
      for (const trailEntity of this.trailEntities.values()) {
        trailEntity.show = false;
      }
    }
  }

  /**
   * Get aircraft at screen position
   * @param {Cartesian2} position - Screen position
   * @returns {ProcessedAircraft|null} Aircraft at position
   */
  getAircraftAtPosition(position) {
    const pickedObject = this.viewer.scene.pick(position);

    if (pickedObject && pickedObject.id && pickedObject.id.aircraftData) {
      return pickedObject.id.aircraftData;
    }

    return null;
  }

  /**
   * Highlight aircraft
   * @param {string} icao24 - Aircraft identifier
   * @param {boolean} highlight - Whether to highlight
   */
  highlightAircraft(icao24, highlight = true) {
    const aircraft = this.aircraft.get(icao24);
    if (!aircraft) return;

    aircraft.isHighlighted = highlight;
    this.updateAircraftEntity(aircraft);
  }

  /**
   * Select aircraft
   * @param {string} icao24 - Aircraft identifier
   * @param {boolean} select - Whether to select
   */
  selectAircraft(icao24, select = true) {
    // Deselect other aircraft first
    if (select) {
      for (const aircraft of this.aircraft.values()) {
        if (aircraft.isSelected && aircraft.icao24 !== icao24) {
          aircraft.isSelected = false;
          this.updateAircraftEntity(aircraft);
        }
      }
    }

    const aircraft = this.aircraft.get(icao24);
    if (!aircraft) return;

    aircraft.isSelected = select;
    this.updateAircraftEntity(aircraft);
  }

  /**
   * Focus camera on aircraft
   * @param {string} icao24 - Aircraft identifier
   */
  focusOnAircraft(icao24) {
    const entity = this.entities.get(icao24);
    if (!entity) return;

    this.viewer.zoomTo(entity);
    this.selectAircraft(icao24, true);
  }

  /**
   * Set up Cesium click and hover handlers
   */
  setupClickHandlers() {
    // Create screen space event handler for clicks
    this.clickHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // Handle left clicks
    this.clickHandler.setInputAction((event) => {
      console.log("Click detected, checking for aircraft at position");
      const pickedObject = this.viewer.scene.pick(event.position);
      if (pickedObject && pickedObject.id) {
        const entity = pickedObject.id;
        // Check if this is an aircraft entity (has icao24 property)
        if (entity.icao24) {
          console.log("Aircraft entity clicked:", entity.icao24);
          const aircraft = this.aircraft.get(entity.icao24);
          if (aircraft && this.eventHandlers.onAircraftClick) {
            console.log("Calling onAircraftClick handler");
            this.eventHandlers.onAircraftClick(aircraft, event.position);
          }
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Handle mouse move for hover (optional)
    this.clickHandler.setInputAction((event) => {
      const pickedObject = this.viewer.scene.pick(event.endPosition);
      let hoveredAircraft = null;

      if (pickedObject && pickedObject.id && pickedObject.id.icao24) {
        hoveredAircraft = this.aircraft.get(pickedObject.id.icao24);
      }

      // If we have a different aircraft than the currently highlighted one
      if (hoveredAircraft !== this.currentlyHighlighted) {
        // Clear previous highlight
        if (this.currentlyHighlighted) {
          this.highlightAircraft(this.currentlyHighlighted.icao24, false);
        }

        // Set new highlight
        if (hoveredAircraft) {
          this.highlightAircraft(hoveredAircraft.icao24, true);
        }

        // Update tracking
        this.currentlyHighlighted = hoveredAircraft;

        // Call hover callback
        if (this.eventHandlers.onAircraftHover) {
          this.eventHandlers.onAircraftHover(hoveredAircraft, event.endPosition);
        }
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
  }

  /**
   * Event handler registration
   */
  onAircraftClick(callback) {
    this.eventHandlers.onAircraftClick = callback;
  }

  onAircraftHover(callback) {
    this.eventHandlers.onAircraftHover = callback;
  }

  /**
   * Handle click events
   */
  handleClick(position) {
    const aircraft = this.getAircraftAtPosition(position);

    if (aircraft && this.eventHandlers.onAircraftClick) {
      this.eventHandlers.onAircraftClick(aircraft, position);
    }

    return aircraft;
  }

  /**
   * Handle hover events
   */
  handleHover(position) {
    const aircraft = this.getAircraftAtPosition(position);

    if (this.eventHandlers.onAircraftHover) {
      this.eventHandlers.onAircraftHover(aircraft, position);
    }

    return aircraft;
  }

  /**
   * Get visualization statistics
   */
  getStatistics() {
    const aircraftArray = Array.from(this.aircraft.values());
    const visibleCount = Array.from(this.entities.values()).filter(
      (entity) => entity.show !== false
    ).length;

    return {
      total: aircraftArray.length,
      visible: visibleCount,
      trails: this.trailEntities.size,
      renderTime: this.lastRenderTime,
      renderCount: this.renderCount,
      ...AircraftClassifier.getStatistics(aircraftArray),
    };
  }

  /**
   * Clear all aircraft from visualization
   */
  clearAircraft() {
    // Remove all entities
    for (const entity of this.entities.values()) {
      this.viewer.entities.remove(entity);
    }

    for (const trailEntity of this.trailEntities.values()) {
      this.viewer.entities.remove(trailEntity);
    }

    // Clear maps
    this.aircraft.clear();
    this.entities.clear();
    this.trailEntities.clear();

    console.log("All aircraft cleared from visualization");
  }

  /**
   * Destroy visualizer and cleanup
   */
  destroy() {
    this.clearAircraft();
    this.eventHandlers = {};
    console.log("Aircraft Visualizer destroyed");
  }
}
