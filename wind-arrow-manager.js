import * as Cesium from 'cesium';
import { LEVEL_COLORS, createArrowTexture, calculateArrowScaleForWindSpeed } from './wind-arrow-textures.js';

/**
 * Manages wind arrow visualization on Cesium map
 * Creates billboard entities showing wind direction and speed at multiple altitudes
 */
export class WindArrowManager {
  constructor(viewer, weatherDataManager) {
    this.viewer = viewer;
    this.weatherDataManager = weatherDataManager;

    // Entity collection for wind arrows
    this.windEntities = new Cesium.CustomDataSource('wind-arrows');
    this.viewer.dataSources.add(this.windEntities);

    // Arrow textures (one per altitude level)
    this.arrowTextures = {};
    this.createArrowTextures();

    // Emitter positions (grid points where arrows are displayed)
    this.emitterPositions = [];
    this.generateEmitterGrid();

    // Layer visibility state
    this.layerVisibility = {
      surface_1000hPa: true,
      pattern_925hPa: true,
      low_cruise_850hPa: true,
      med_cruise_700hPa: true,
      high_cruise_500hPa: true,
      fl250_300hPa: false  // FL250 off by default
    };

    // Current grid data
    this.currentGridData = null;

    console.log('[WindArrowManager] Initialized with', this.emitterPositions.length, 'emitters');
  }

  /**
   * Create arrow textures for each altitude level
   */
  createArrowTextures() {
    Object.entries(LEVEL_COLORS).forEach(([levelKey, color]) => {
      const canvas = createArrowTexture(color, 32);
      this.arrowTextures[levelKey] = canvas;
    });

    console.log('[WindArrowManager] Created arrow textures for', Object.keys(this.arrowTextures).length, 'levels');
  }

  /**
   * Generate grid of emitter positions across Slovenia
   * Target: ~40 emitters at 0.35° spacing
   */
  generateEmitterGrid() {
    const bounds = {
      latMin: 45.4,
      latMax: 46.9,
      lonMin: 13.4,
      lonMax: 16.6
    };

    const spacing = 0.35; // degrees (~39 km at this latitude)

    for (let lat = bounds.latMin; lat <= bounds.latMax; lat += spacing) {
      for (let lon = bounds.lonMin; lon <= bounds.lonMax; lon += spacing) {
        this.emitterPositions.push({
          latitude: parseFloat(lat.toFixed(2)),
          longitude: parseFloat(lon.toFixed(2))
        });
      }
    }

    console.log('[WindArrowManager] Generated', this.emitterPositions.length, 'emitter positions');
  }

  /**
   * Load weather data and update wind arrows
   * @param {Object} options - Options {forceRefresh: boolean}
   * @returns {Promise<void>}
   */
  async updateWindArrows(options = {}) {
    console.log('[WindArrowManager] Updating wind arrows...');

    try {
      // Fetch grid data
      this.currentGridData = await this.weatherDataManager.getWindData(options);

      if (!this.currentGridData || !this.currentGridData.grid) {
        console.error('[WindArrowManager] Invalid grid data received');
        return;
      }

      // Clear existing arrows
      this.windEntities.entities.removeAll();

      // Create arrows for each emitter and each visible level
      let arrowCount = 0;

      Object.entries(this.layerVisibility).forEach(([levelKey, isVisible]) => {
        if (!isVisible) return;

        this.emitterPositions.forEach(pos => {
          const windData = this.weatherDataManager.getWindAtLocation(
            this.currentGridData,
            pos.latitude,
            pos.longitude,
            levelKey
          );

          if (windData && windData.windspeed_kmh > 0) {
            this.createWindArrow(pos, windData, levelKey);
            arrowCount++;
          }
        });
      });

      console.log('[WindArrowManager] Created', arrowCount, 'wind arrows');

    } catch (error) {
      console.error('[WindArrowManager] Failed to update wind arrows:', error);
    }
  }

  /**
   * Create a single wind arrow billboard
   * @param {Object} position - {latitude, longitude}
   * @param {Object} windData - {windspeed_kmh, winddirection_deg, temperature_c}
   * @param {string} levelKey - Altitude level key
   */
  createWindArrow(position, windData, levelKey) {
    const { windspeed_kmh, winddirection_deg, temperature_c } = windData;

    // Get altitude for this level (use geopotential height if available, else estimated)
    const altitude = this.getAltitudeForLevel(levelKey);

    // Calculate arrow rotation (wind direction in degrees)
    // Cesium rotation is counter-clockwise from east, wind direction is clockwise from north
    const rotationRadians = Cesium.Math.toRadians(90 - winddirection_deg);

    // Scale arrow by wind speed
    const scale = calculateArrowScaleForWindSpeed(windspeed_kmh);

    // Create billboard entity
    this.windEntities.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        altitude
      ),
      billboard: {
        image: this.arrowTextures[levelKey],
        scale: scale,
        rotation: rotationRadians,
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        width: 32,
        height: 32,
        // Slight transparency
        color: new Cesium.Color(1, 1, 1, 0.85),
        // Disable depth test so arrows are always visible
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      // Store metadata
      properties: {
        type: 'wind_arrow',
        level: levelKey,
        windspeed_kmh: windspeed_kmh,
        winddirection_deg: winddirection_deg,
        temperature_c: temperature_c
      }
    });
  }

  /**
   * Get altitude in meters for a given level
   * @param {string} levelKey - Level key
   * @returns {number} Altitude in meters
   */
  getAltitudeForLevel(levelKey) {
    const altitudes = {
      surface_1000hPa: 100,
      pattern_925hPa: 750,
      low_cruise_850hPa: 1500,
      med_cruise_700hPa: 3000,
      high_cruise_500hPa: 5600,
      fl250_300hPa: 9200
    };

    return altitudes[levelKey] || 0;
  }

  /**
   * Toggle visibility of a specific altitude level
   * @param {string} levelKey - Level key
   * @param {boolean} visible - Visibility state
   */
  setLayerVisibility(levelKey, visible) {
    if (this.layerVisibility[levelKey] === undefined) {
      console.warn('[WindArrowManager] Unknown level:', levelKey);
      return;
    }

    this.layerVisibility[levelKey] = visible;
    console.log('[WindArrowManager]', levelKey, 'visibility:', visible);

    // Update arrows (will recreate with new visibility)
    if (this.currentGridData) {
      this.updateWindArrows();
    }
  }

  /**
   * Get current layer visibility state
   * @returns {Object} Layer visibility state
   */
  getLayerVisibility() {
    return { ...this.layerVisibility };
  }

  /**
   * Show all layers
   */
  showAllLayers() {
    Object.keys(this.layerVisibility).forEach(key => {
      this.layerVisibility[key] = true;
    });

    if (this.currentGridData) {
      this.updateWindArrows();
    }
  }

  /**
   * Hide all layers
   */
  hideAllLayers() {
    Object.keys(this.layerVisibility).forEach(key => {
      this.layerVisibility[key] = false;
    });

    this.windEntities.entities.removeAll();
  }

  /**
   * Remove all wind arrows
   */
  clear() {
    this.windEntities.entities.removeAll();
    this.currentGridData = null;
    console.log('[WindArrowManager] Cleared all wind arrows');
  }

  /**
   * Destroy manager and clean up resources
   */
  destroy() {
    this.viewer.dataSources.remove(this.windEntities);
    this.arrowTextures = {};
    this.emitterPositions = [];
    this.currentGridData = null;
    console.log('[WindArrowManager] Destroyed');
  }
}
