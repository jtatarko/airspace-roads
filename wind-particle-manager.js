import * as Cesium from "cesium";
import { WindLayer } from "cesium-wind-layer";

/**
 * Manages wind particle visualization using cesium-wind-layer
 * GPU-accelerated particle system showing wind flow patterns
 */
export class WindParticleManager {
  constructor(viewer, weatherDataManager) {
    this.viewer = viewer;
    this.weatherDataManager = weatherDataManager;

    // Active wind layers (one per altitude level)
    this.windLayers = {};

    // Layer visibility and configuration
    this.layerConfig = {
      surface_1000hPa: {
        enabled: true,
        altitude: 100,
        name: "Surface (100m)",
        color: { r: 1.0, g: 1.0, b: 1.0 }, // White
      },
      pattern_925hPa: {
        enabled: true,
        altitude: 750,
        name: "Pattern (750m)",
        color: { r: 1.0, g: 0.65, b: 0.0 }, // Orange
      },
      low_cruise_850hPa: {
        enabled: true,
        altitude: 1500,
        name: "Low Cruise (1,500m)",
        color: { r: 1.0, g: 1.0, b: 0.0 }, // Yellow
      },
      med_cruise_700hPa: {
        enabled: true,
        altitude: 3000,
        name: "Med Cruise (3,000m)",
        color: { r: 0.0, g: 1.0, b: 0.0 }, // Lime
      },
      high_cruise_500hPa: {
        enabled: true,
        altitude: 5600,
        name: "High Cruise (5,600m)",
        color: { r: 0.0, g: 1.0, b: 1.0 }, // Cyan
      },
      fl250_300hPa: {
        enabled: false, // FL250 off by default
        altitude: 9200,
        name: "FL250 (9,200m)",
        color: { r: 0.5, g: 0.0, b: 0.5 }, // Purple
      },
    };

    // Current grid data
    this.currentGridData = null;

    // Click handler for wind info display
    this.clickHandler = null;

    // Track wind info entities for cleanup
    this.windInfoEntities = [];

    this.enableClickHandler();

    console.log("[WindParticleManager] Initialized");
  }

  /**
   * Enable click handler to show wind data at clicked location
   */
  enableClickHandler() {
    this.clickHandler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    this.clickHandler.setInputAction((click) => {
      if (!this.currentGridData) return;

      // Get clicked position
      const cartesian = this.viewer.camera.pickEllipsoid(
        click.position,
        this.viewer.scene.globe.ellipsoid
      );
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);

      // Get wind data for all altitude levels
      this.showWindInfoAtLocation(latitude, longitude);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Listen for when InfoBox is closed to clean up entities
    this.viewer.selectedEntityChanged.addEventListener(
      this.onSelectedEntityChanged.bind(this)
    );

    console.log("[WindParticleManager] Click handler enabled");
  }

  /**
   * Handle selected entity changes to clean up wind info entities
   */
  onSelectedEntityChanged() {
    // Clean up old wind info entities when user closes InfoBox or selects something else
    this.windInfoEntities.forEach((entity) => {
      if (this.viewer.selectedEntity !== entity) {
        this.viewer.entities.remove(entity);
      }
    });

    // Clear the array, keeping only the currently selected entity if it's a wind info entity
    this.windInfoEntities = this.windInfoEntities.filter(
      (entity) => this.viewer.selectedEntity === entity
    );
  }

  /**
   * Disable click handler
   */
  disableClickHandler() {
    if (this.clickHandler) {
      this.clickHandler.destroy();
      this.clickHandler = null;
      console.log("[WindParticleManager] Click handler disabled");
    }
  }

  /**
   * Show wind information at a specific location
   * @param {number} latitude - Latitude in degrees
   * @param {number} longitude - Longitude in degrees
   */
  showWindInfoAtLocation(latitude, longitude) {
    if (!this.currentGridData) {
      console.warn("[WindParticleManager] No wind data available");
      return;
    }

    // Build HTML content with wind data for all levels
    let htmlContent = `
      <div style="font-family: monospace; font-size: 12px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px;">💨 Wind Data</h3>
        <div style="color: #888; font-size: 11px; margin-bottom: 10px;">
          ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #ccc;">
              <th style="text-align: left; padding: 4px;">Altitude</th>
              <th style="text-align: right; padding: 4px;">Speed</th>
              <th style="text-align: right; padding: 4px;">Direction</th>
              <th style="text-align: right; padding: 4px;">Temp</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Get wind data for each altitude level (only visible ones)
    let visibleLevelCount = 0;
    for (const [levelKey, config] of Object.entries(this.layerConfig)) {
      // Skip disabled layers
      if (!config.enabled) continue;

      try {
        const windData = this.weatherDataManager.getWindAtLocation(
          this.currentGridData,
          latitude,
          longitude,
          levelKey
        );

        const speedKmh = windData.windspeed_kmh.toFixed(1);
        const speedKnots = (windData.windspeed_kmh * 0.539957).toFixed(1);
        const direction = Math.round(windData.winddirection_deg);
        const cardinal = this.getCardinalDirection(direction);
        const temp = windData.temperature_c.toFixed(1);

        // Color indicator matching particle color
        const colorRgb = `rgb(${Math.round(config.color.r * 255)}, ${Math.round(config.color.g * 255)}, ${Math.round(config.color.b * 255)})`;

        htmlContent += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${colorRgb}; border: 1px solid #666; margin-right: 6px; vertical-align: middle;"></span>
              ${config.name}
            </td>
            <td style="text-align: right; padding: 4px;">${speedKmh} km/h<br/><span style="color: #888;">(${speedKnots} kt)</span></td>
            <td style="text-align: right; padding: 4px;">${direction}° ${cardinal}</td>
            <td style="text-align: right; padding: 4px;">${temp}°C</td>
          </tr>
        `;
        visibleLevelCount++;
      } catch (error) {
        console.error(
          "[WindParticleManager] Error getting wind at location:",
          error
        );
      }
    }

    // If no layers are visible, show a message
    if (visibleLevelCount === 0) {
      htmlContent += `
        <tr>
          <td colspan="4" style="padding: 15px; text-align: center; color: #888;">
            No wind layers visible.<br/>
            <span style="font-size: 11px;">Enable layers to see wind data.</span>
          </td>
        </tr>
      `;
    }

    htmlContent += `
          </tbody>
        </table>
      </div>
    `;

    // Create an invisible entity at the clicked location to attach the info box
    const entity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
      name: "Wind Info",
      description: htmlContent,
    });

    // Track this entity for cleanup later
    this.windInfoEntities.push(entity);

    // Select the entity to show the info box
    this.viewer.selectedEntity = entity;

    // Entity will be removed automatically when InfoBox is closed via onSelectedEntityChanged
  }

  /**
   * Convert wind direction to cardinal direction
   * @param {number} degrees - Wind direction in degrees
   * @returns {string} Cardinal direction (N, NE, E, etc.)
   */
  getCardinalDirection(degrees) {
    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round((degrees % 360) / 22.5) % 16;
    return directions[index];
  }

  /**
   * Load weather data and create particle layers
   * @param {Object} options - Options {forceRefresh: boolean}
   * @returns {Promise<void>}
   */
  async updateWindParticles(options = {}) {
    console.log("[WindParticleManager] Updating wind particles...");

    try {
      // Fetch grid data
      this.currentGridData = await this.weatherDataManager.getWindData(options);

      if (!this.currentGridData || !this.currentGridData.grid) {
        console.error("[WindParticleManager] Invalid grid data received");
        return;
      }

      // Clear existing layers
      this.clearAllLayers();

      // Create particle layer for each enabled altitude level
      let layerCount = 0;

      for (const [levelKey, config] of Object.entries(this.layerConfig)) {
        if (config.enabled) {
          await this.createParticleLayer(levelKey, config);
          layerCount++;
        }
      }

      console.log(
        "[WindParticleManager] Created",
        layerCount,
        "wind particle layers"
      );
    } catch (error) {
      console.error(
        "[WindParticleManager] Failed to update wind particles:",
        error
      );
      throw error;
    }
  }

  /**
   * Create a single wind particle layer for an altitude level
   * @param {string} levelKey - Altitude level key
   * @param {Object} config - Layer configuration
   */
  async createParticleLayer(levelKey, config) {
    console.log("[WindParticleManager] Creating particle layer for", levelKey);

    // Convert wind data to U/V components
    const windData = this.weatherDataManager.convertToUVComponents(
      this.currentGridData,
      levelKey
    );

    console.log("[WindParticleManager] Wind data structure:", {
      hasU: !!windData.u,
      hasV: !!windData.v,
      width: windData.width,
      height: windData.height,
      uArrayLength: windData.u?.array?.length,
      vArrayLength: windData.v?.array?.length,
    });

    // Prepare data in cesium-wind-layer format (lowercase property names!)
    const layerData = {
      u: windData.u,
      v: windData.v,
      width: windData.width,
      height: windData.height,
      bounds: windData.bounds,
    };

    // Create particle layer with configuration
    const windLayer = new WindLayer(this.viewer, layerData, {
      // Particle appearance
      particlesTextureSize: 64, // Number of particles (64x64 = 4096 particles)
      particleHeight: config.altitude, // Altitude in meters

      // Line appearance
      lineWidth: {
        min: 0.5,
        max: 1.0,
      },
      lineLength: {
        min: 30,
        max: 60,
      },

      // Animation
      speedFactor: 0.1, // Speed multiplier (0.01 = realistic visual speed)
      dropRate: 0.0001, // Rate at which particles reset
      dropRateBump: 0, // Random variation in drop rate

      // Colors (use altitude-specific color)
      colors: [
        `rgba(${Math.round(config.color.r * 255)}, ${Math.round(
          config.color.g * 255
        )}, ${Math.round(config.color.b * 255)}, 0.0)`,
        `rgba(${Math.round(config.color.r * 255)}, ${Math.round(
          config.color.g * 255
        )}, ${Math.round(config.color.b * 255)}, 0.5)`,
        `rgba(${Math.round(config.color.r * 255)}, ${Math.round(
          config.color.g * 255
        )}, ${Math.round(config.color.b * 255)}, 1.0)`,
      ],

      // Dynamic animation
      dynamic: true,

      // Flip Y coordinate if needed
      flipY: false,
    });

    // Store layer reference
    this.windLayers[levelKey] = windLayer;

    console.log(
      "[WindParticleManager] Particle layer created for",
      levelKey,
      "at",
      config.altitude,
      "m"
    );
  }

  /**
   * Toggle visibility of a specific altitude level
   * @param {string} levelKey - Level key
   * @param {boolean} visible - Visibility state
   */
  async setLayerVisibility(levelKey, visible) {
    if (!this.layerConfig[levelKey]) {
      console.warn("[WindParticleManager] Unknown level:", levelKey);
      return;
    }

    this.layerConfig[levelKey].enabled = visible;
    console.log("[WindParticleManager]", levelKey, "visibility:", visible);

    if (!this.currentGridData) {
      return; // No data loaded yet
    }

    if (visible) {
      // Create layer if it doesn't exist
      if (!this.windLayers[levelKey]) {
        await this.createParticleLayer(levelKey, this.layerConfig[levelKey]);
      }
    } else {
      // Remove layer if it exists
      if (this.windLayers[levelKey]) {
        this.windLayers[levelKey].remove();
        delete this.windLayers[levelKey];
      }
    }
  }

  /**
   * Get current layer visibility state
   * @returns {Object} Layer visibility state
   */
  getLayerVisibility() {
    const visibility = {};
    for (const [levelKey, config] of Object.entries(this.layerConfig)) {
      visibility[levelKey] = config.enabled;
    }
    return visibility;
  }

  /**
   * Show all layers
   */
  async showAllLayers() {
    for (const levelKey of Object.keys(this.layerConfig)) {
      await this.setLayerVisibility(levelKey, true);
    }
  }

  /**
   * Hide all layers
   */
  hideAllLayers() {
    for (const levelKey of Object.keys(this.layerConfig)) {
      this.setLayerVisibility(levelKey, false);
    }
  }

  /**
   * Clear all wind particle layers
   */
  clearAllLayers() {
    for (const [levelKey, windLayer] of Object.entries(this.windLayers)) {
      windLayer.remove();
    }
    this.windLayers = {};
    console.log("[WindParticleManager] Cleared all particle layers");
  }

  /**
   * Remove all layers and clean up
   */
  clear() {
    this.clearAllLayers();
    this.currentGridData = null;
  }

  /**
   * Destroy manager and clean up resources
   */
  destroy() {
    this.clearAllLayers();
    this.disableClickHandler();
    this.currentGridData = null;
    console.log("[WindParticleManager] Destroyed");
  }
}
