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

    console.log("[WindParticleManager] Initialized");
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
      speedFactor: 0.2, // Speed multiplier (0.01 = realistic visual speed)
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
    this.currentGridData = null;
    console.log("[WindParticleManager] Destroyed");
  }
}
