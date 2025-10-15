/**
 * WeatherDataManager
 *
 * Manages weather data from multiple sources with smart fallback:
 * 1. Test Fixtures (offline development)
 * 2. Browser Cache (recent API responses)
 * 3. Live API (Open-Meteo)
 *
 * Provides consistent data format for wind visualization.
 */

export class WeatherDataManager {
  constructor(options = {}) {
    this.dataSource = 'fixture';  // 'fixture' | 'cache' | 'live' | 'live_grid'
    this.currentFixture = null;
    this.cache = new Map();
    this.lastApiCall = null;
    this.apiCallInterval = 30 * 60 * 1000;  // 30 minutes
    this.baseFixturePath = './data/weather/fixtures/';

    // Grid API configuration
    this.useGridAPI = options.useGridAPI !== undefined ? options.useGridAPI : true;  // Default to grid
    this.gridBounds = options.gridBounds || {
      latMin: 45.4,   // Slovenia south
      latMax: 46.9,   // Slovenia north
      lonMin: 13.4,   // Slovenia west
      lonMax: 16.6    // Slovenia east
    };
  }

  /**
   * Main data retrieval method with smart fallback
   * @param {Object} options - { forceRefresh, useFixture }
   * @returns {Promise<Object>} Normalized weather data
   */
  async getWindData(options = {}) {
    const { forceRefresh = false, useFixture = null } = options;

    // Priority 1: Explicit fixture request
    if (useFixture) {
      return await this.loadFixture(useFixture);
    }

    // Priority 2: Check cache (if not forcing refresh)
    if (!forceRefresh && this.isCacheValid()) {
      console.log('[WeatherDataManager] Using cached weather data');
      return this.getCachedData();
    }

    // Priority 3: Try live API (grid or single point)
    try {
      console.log('[WeatherDataManager] Fetching fresh weather data from Open-Meteo API...');
      const liveData = this.useGridAPI ? await this.fetchGridFromAPI() : await this.fetchFromAPI();
      this.cacheData(liveData);
      this.saveToLocalStorage(liveData);
      return liveData;
    } catch (error) {
      console.warn('[WeatherDataManager] API fetch failed, falling back:', error.message);

      // Priority 4: Fallback to cache (even if expired)
      const cachedData = this.getCachedData();
      if (cachedData) {
        console.log('[WeatherDataManager] Using expired cache as fallback');
        return cachedData;
      }

      // Priority 5: Fallback to localStorage
      const storedData = this.loadFromLocalStorage();
      if (storedData) {
        console.log('[WeatherDataManager] Using localStorage as fallback');
        this.cacheData(storedData);
        return storedData;
      }

      // Priority 6: Fallback to default fixture
      console.log('[WeatherDataManager] Using default fixture as last resort');
      return await this.loadFixture('slovenia-wind-sample-1.json');
    }
  }

  /**
   * Load fixture from file
   * @param {string} fixtureName - Filename (e.g., 'slovenia-wind-sample-1.json')
   * @returns {Promise<Object>} Normalized weather data
   */
  async loadFixture(fixtureName) {
    try {
      const response = await fetch(`${this.baseFixturePath}${fixtureName}`);
      if (!response.ok) {
        throw new Error(`Failed to load fixture: ${response.status}`);
      }

      const data = await response.json();

      console.log(`[WeatherDataManager] Loaded fixture: ${data.fixture_metadata?.name || fixtureName}`);
      this.currentFixture = fixtureName;
      this.dataSource = 'fixture';

      return this.normalizeData(data);
    } catch (error) {
      console.error('[WeatherDataManager] Failed to load fixture:', error);
      throw error;
    }
  }

  /**
   * Fetch from Open-Meteo API
   * @returns {Promise<Object>} Normalized weather data
   */
  async fetchFromAPI() {
    const params = this.buildAPIParams();
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;

    console.log('[WeatherDataManager] API URL:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    this.lastApiCall = Date.now();
    this.dataSource = 'live';

    console.log('[WeatherDataManager] API data received successfully');

    return this.normalizeData(rawData);
  }

  /**
   * Build API query parameters for Open-Meteo
   * @returns {string} URL query parameters
   */
  buildAPIParams() {
    const levels = ['1000hPa', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa'];
    const params = [];

    // Location: Ljubljana, Slovenia (center)
    params.push('latitude=46.05');
    params.push('longitude=14.5');

    // Request all wind parameters for all 6 levels
    const hourlyParams = [];
    levels.forEach(level => {
      hourlyParams.push(
        `temperature_${level}`,
        `windspeed_${level}`,
        `winddirection_${level}`,
        `relativehumidity_${level}`,
        `cloudcover_${level}`,
        `geopotential_height_${level}`
      );
    });

    // Add surface precipitation
    hourlyParams.push('precipitation', 'cloudcover');

    params.push(`hourly=${hourlyParams.join(',')}`);
    params.push('timezone=auto');
    params.push('forecast_days=1');  // Only need current + few hours

    return params.join('&');
  }

  /**
   * Normalize data from any source to consistent format
   * @param {Object} rawData - Data from fixture or API
   * @returns {Object} Normalized weather data
   */
  normalizeData(rawData) {
    // Check if already normalized (fixture format)
    if (rawData.fixture_metadata) {
      return rawData;
    }

    // Transform Open-Meteo API response to our format
    const currentHour = rawData.hourly.time[0];  // First hour (current)

    return {
      timestamp: currentHour,
      location: {
        latitude: rawData.latitude,
        longitude: rawData.longitude,
        elevation: rawData.elevation
      },
      wind_data: {
        surface_1000hPa: this.extractLevelData(rawData, '1000hPa', 0),
        pattern_925hPa: this.extractLevelData(rawData, '925hPa', 0),
        low_cruise_850hPa: this.extractLevelData(rawData, '850hPa', 0),
        med_cruise_700hPa: this.extractLevelData(rawData, '700hPa', 0),
        high_cruise_500hPa: this.extractLevelData(rawData, '500hPa', 0),
        fl250_300hPa: this.extractLevelData(rawData, '300hPa', 0)
      },
      precipitation: {
        total_mm: rawData.hourly.precipitation?.[0] || 0
      }
    };
  }

  /**
   * Extract single level data from API response
   * @param {Object} apiResponse - Raw API response
   * @param {string} level - Pressure level (e.g., '850hPa')
   * @param {number} hourIndex - Hour index (0 = current)
   * @returns {Object} Level data
   */
  extractLevelData(apiResponse, level, hourIndex) {
    return {
      temperature_c: apiResponse.hourly[`temperature_${level}`]?.[hourIndex] || null,
      windspeed_kmh: apiResponse.hourly[`windspeed_${level}`]?.[hourIndex] || 0,
      winddirection_deg: apiResponse.hourly[`winddirection_${level}`]?.[hourIndex] || 0,
      relativehumidity_pct: apiResponse.hourly[`relativehumidity_${level}`]?.[hourIndex] || null,
      cloudcover_pct: apiResponse.hourly[`cloudcover_${level}`]?.[hourIndex] || null,
      geopotential_height_m: apiResponse.hourly[`geopotential_height_${level}`]?.[hourIndex] || null
    };
  }

  /**
   * Cache data in memory
   * @param {Object} data - Weather data to cache
   */
  cacheData(data) {
    this.cache.set('current', {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached data
   * @returns {Object|null} Cached weather data
   */
  getCachedData() {
    const cached = this.cache.get('current');
    return cached?.data || null;
  }

  /**
   * Check if cache is still valid
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    const cached = this.cache.get('current');
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < this.apiCallInterval;
  }

  /**
   * Save data to localStorage for persistence
   * @param {Object} data - Weather data to save
   */
  saveToLocalStorage(data) {
    try {
      localStorage.setItem('weather_wind_data', JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
      console.log('[WeatherDataManager] Saved to localStorage');
    } catch (error) {
      console.warn('[WeatherDataManager] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load data from localStorage
   * @returns {Object|null} Weather data from localStorage
   */
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('weather_wind_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if not too old (2 hours max)
        const age = Date.now() - parsed.timestamp;
        if (age < 2 * 60 * 60 * 1000) {
          console.log('[WeatherDataManager] Loaded from localStorage');
          return parsed.data;
        } else {
          console.log('[WeatherDataManager] localStorage data too old, ignoring');
        }
      }
    } catch (error) {
      console.warn('[WeatherDataManager] Failed to load from localStorage:', error);
    }
    return null;
  }

  /**
   * Get list of available fixtures
   * @returns {Promise<Object>} Fixture metadata
   */
  async getAvailableFixtures() {
    try {
      const response = await fetch(`${this.baseFixturePath}metadata.json`);
      if (!response.ok) {
        throw new Error('Metadata not found');
      }
      return await response.json();
    } catch (error) {
      console.warn('[WeatherDataManager] Failed to load fixture metadata:', error);
      // Return basic list if metadata not available
      return {
        fixtures: [
          { filename: 'slovenia-wind-sample-1.json', name: 'Calm Winds - Spring' },
          { filename: 'slovenia-wind-sample-2.json', name: 'Moderate Winds - Summer' },
          { filename: 'slovenia-wind-storm.json', name: 'Storm Conditions' }
        ],
        default_fixture: 'slovenia-wind-sample-1.json'
      };
    }
  }

  /**
   * Export current data as fixture (for testing)
   * @param {string} name - Fixture name
   * @param {string} description - Fixture description
   */
  exportAsFixture(name, description) {
    const currentData = this.getCachedData();
    if (!currentData) {
      throw new Error('No data to export');
    }

    const fixture = {
      fixture_metadata: {
        name: name,
        description: description,
        created: new Date().toISOString(),
        exported_from: 'live_api',
        scenario: 'custom'
      },
      api_source: {
        provider: 'Open-Meteo',
        endpoint: 'https://api.open-meteo.com/v1/forecast',
        captured_at: new Date().toISOString()
      },
      ...currentData
    };

    // Download as JSON file
    const blob = new Blob([JSON.stringify(fixture, null, 2)],
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `slovenia-wind-${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`[WeatherDataManager] Exported fixture: ${a.download}`);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    localStorage.removeItem('weather_wind_data');
    console.log('[WeatherDataManager] Cache cleared');
  }

  /**
   * Get current data source info
   * @returns {Object} Data source information
   */
  getDataSourceInfo() {
    return {
      source: this.dataSource,
      fixture: this.currentFixture,
      lastApiCall: this.lastApiCall,
      cacheValid: this.isCacheValid(),
      cacheAge: this.cache.has('current') ?
        Date.now() - this.cache.get('current').timestamp : null,
      usingGridAPI: this.useGridAPI,
      gridBounds: this.gridBounds
    };
  }

  /**
   * Fetch grid data from DWD ICON API
   * @returns {Promise<Object>} Normalized grid weather data
   */
  async fetchGridFromAPI() {
    const { params, grid } = this.buildGridAPIParams();
    const url = `https://api.open-meteo.com/v1/dwd-icon?${params}`;

    console.log('[WeatherDataManager] Grid API URL (truncated):', url.substring(0, 200) + '...');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Grid API returned ${response.status}: ${response.statusText}`);
    }

    const rawDataArray = await response.json();
    this.lastApiCall = Date.now();
    this.dataSource = 'live_grid';

    console.log('[WeatherDataManager] Raw API response:', {
      isArray: Array.isArray(rawDataArray),
      length: rawDataArray.length,
      firstItem: rawDataArray[0] ? {
        lat: rawDataArray[0].latitude,
        lon: rawDataArray[0].longitude,
        hasHourly: !!rawDataArray[0].hourly
      } : null
    });

    const normalized = this.normalizeGridData(rawDataArray, grid);
    console.log('[WeatherDataManager] Normalized data structure:', {
      hasLocation: !!normalized.location,
      hasGrid: !!normalized.grid,
      hasWindData: !!normalized.grid?.wind_data,
      gridSize: `${normalized.grid?.latitudes.length} × ${normalized.grid?.longitudes.length}`
    });

    return normalized;
  }

  /**
   * Generate grid points for API request
   * @returns {Object} Grid structure {latitudes: [], longitudes: []}
   */
  generateGridPoints() {
    const resolution = 0.1; // ~11 km at this latitude
    const latitudes = [];
    const longitudes = [];

    // Generate latitude points
    for (let lat = this.gridBounds.latMin; lat <= this.gridBounds.latMax; lat += resolution) {
      latitudes.push(parseFloat(lat.toFixed(2)));
    }

    // Generate longitude points
    for (let lon = this.gridBounds.lonMin; lon <= this.gridBounds.lonMax; lon += resolution) {
      longitudes.push(parseFloat(lon.toFixed(2)));
    }

    const totalPoints = latitudes.length * longitudes.length;
    console.log('[WeatherDataManager] Generated grid:',
      latitudes.length, 'lat ×', longitudes.length, 'lon =', totalPoints, 'points');

    if (totalPoints > 1000) {
      console.warn('[WeatherDataManager] Grid exceeds 1000 point API limit, will be truncated');
    }

    return { latitudes, longitudes };
  }

  /**
   * Build API query parameters for grid request
   * @returns {Object} {params: string, grid: {latitudes: [], longitudes: []}}
   */
  buildGridAPIParams() {
    const grid = this.generateGridPoints();
    const params = [];

    // Create all lat/lon pairs (row-major order)
    const allLats = [];
    const allLons = [];

    grid.latitudes.forEach(lat => {
      grid.longitudes.forEach(lon => {
        allLats.push(lat);
        allLons.push(lon);
      });
    });

    // Multiple locations format: latitude=lat1,lat2,lat3&longitude=lon1,lon2,lon3
    params.push(`latitude=${allLats.join(',')}`);
    params.push(`longitude=${allLons.join(',')}`);

    // Request wind parameters for all 6 levels
    const levels = ['1000hPa', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa'];
    const hourlyParams = [];

    levels.forEach(level => {
      hourlyParams.push(
        `temperature_${level}`,
        `windspeed_${level}`,
        `winddirection_${level}`,
        `geopotential_height_${level}`
      );
    });

    params.push(`hourly=${hourlyParams.join(',')}`);
    params.push('timezone=Europe/Ljubljana');
    params.push('forecast_days=1');

    return { params: params.join('&'), grid };
  }

  /**
   * Normalize grid data to our format
   * @param {Array} rawDataArray - Array of location weather objects from API
   * @param {Object} gridStructure - Grid structure {latitudes: [], longitudes: []}
   * @returns {Object} Normalized grid weather data
   */
  normalizeGridData(rawDataArray, gridStructure) {
    const currentHour = 0;  // First hour (current)

    // Get timestamp from first location
    const timestamp = rawDataArray[0]?.hourly?.time?.[currentHour] || new Date().toISOString();

    return {
      timestamp,
      location: {
        latitude_range: [
          gridStructure.latitudes[0],
          gridStructure.latitudes[gridStructure.latitudes.length - 1]
        ],
        longitude_range: [
          gridStructure.longitudes[0],
          gridStructure.longitudes[gridStructure.longitudes.length - 1]
        ],
        grid_resolution: (gridStructure.latitudes[1] - gridStructure.latitudes[0]).toFixed(4)
      },
      grid: {
        latitudes: gridStructure.latitudes,
        longitudes: gridStructure.longitudes,
        wind_data: this.extractGridWindData(rawDataArray, gridStructure, currentHour)
      }
    };
  }

  /**
   * Extract wind data from grid at specific hour
   * @param {Array} rawDataArray - Array of location weather objects
   * @param {Object} gridStructure - Grid structure {latitudes: [], longitudes: []}
   * @param {number} hourIndex - Hour index
   * @returns {Object} Extracted grid wind data as 2D arrays
   */
  extractGridWindData(rawDataArray, gridStructure, hourIndex) {
    const levels = {
      surface_1000hPa: '1000hPa',
      pattern_925hPa: '925hPa',
      low_cruise_850hPa: '850hPa',
      med_cruise_700hPa: '700hPa',
      high_cruise_500hPa: '500hPa',
      fl250_300hPa: '300hPa'
    };

    const numLats = gridStructure.latitudes.length;
    const numLons = gridStructure.longitudes.length;
    const gridWindData = {};

    Object.entries(levels).forEach(([levelKey, hPa]) => {
      // Initialize 2D arrays
      const windspeed = Array(numLats).fill(null).map(() => Array(numLons).fill(0));
      const winddirection = Array(numLats).fill(null).map(() => Array(numLons).fill(0));
      const temperature = Array(numLats).fill(null).map(() => Array(numLons).fill(0));
      const geopotential_height = Array(numLats).fill(null).map(() => Array(numLons).fill(0));

      // Fill arrays from location data (row-major order)
      let locationIndex = 0;
      for (let latIdx = 0; latIdx < numLats; latIdx++) {
        for (let lonIdx = 0; lonIdx < numLons; lonIdx++) {
          const location = rawDataArray[locationIndex];
          if (location && location.hourly) {
            windspeed[latIdx][lonIdx] = location.hourly[`windspeed_${hPa}`]?.[hourIndex] || 0;
            winddirection[latIdx][lonIdx] = location.hourly[`winddirection_${hPa}`]?.[hourIndex] || 0;
            temperature[latIdx][lonIdx] = location.hourly[`temperature_${hPa}`]?.[hourIndex] || 0;
            geopotential_height[latIdx][lonIdx] = location.hourly[`geopotential_height_${hPa}`]?.[hourIndex] || 0;
          }
          locationIndex++;
        }
      }

      gridWindData[levelKey] = {
        windspeed,
        winddirection,
        temperature,
        geopotential_height
      };
    });

    return gridWindData;
  }

  /**
   * Get wind at specific lat/lon using bilinear interpolation
   * @param {Object} gridData - Normalized grid data
   * @param {number} targetLat - Target latitude
   * @param {number} targetLon - Target longitude
   * @param {string} levelKey - Level key (e.g., 'low_cruise_850hPa')
   * @returns {Object} Interpolated wind data
   */
  getWindAtLocation(gridData, targetLat, targetLon, levelKey) {
    const grid = gridData.grid;
    const levelData = grid.wind_data[levelKey];

    // Find surrounding grid points
    const latIndex = this.findGridIndex(grid.latitudes, targetLat);
    const lonIndex = this.findGridIndex(grid.longitudes, targetLon);

    // Bilinear interpolation
    return this.bilinearInterpolate(
      grid.latitudes,
      grid.longitudes,
      levelData,
      latIndex,
      lonIndex,
      targetLat,
      targetLon
    );
  }

  /**
   * Find nearest grid index for coordinate
   * @param {Array} gridArray - Array of grid coordinates
   * @param {number} targetValue - Target coordinate value
   * @returns {number} Grid index
   */
  findGridIndex(gridArray, targetValue) {
    for (let i = 0; i < gridArray.length - 1; i++) {
      if (targetValue >= gridArray[i] && targetValue <= gridArray[i + 1]) {
        return i;
      }
    }
    return gridArray.length - 2;  // Fallback to last valid pair
  }

  /**
   * Bilinear interpolation for grid data
   * @param {Array} lats - Latitude grid
   * @param {Array} lons - Longitude grid
   * @param {Object} data - Level data with 2D arrays
   * @param {number} latIdx - Latitude index
   * @param {number} lonIdx - Longitude index
   * @param {number} targetLat - Target latitude
   * @param {number} targetLon - Target longitude
   * @returns {Object} Interpolated values
   */
  bilinearInterpolate(lats, lons, data, latIdx, lonIdx, targetLat, targetLon) {
    // Get 4 surrounding points
    const lat1 = lats[latIdx];
    const lat2 = lats[latIdx + 1];
    const lon1 = lons[lonIdx];
    const lon2 = lons[lonIdx + 1];

    // Wind speed at 4 corners
    const ws11 = data.windspeed[latIdx]?.[lonIdx] || 0;      // Bottom-left
    const ws12 = data.windspeed[latIdx]?.[lonIdx + 1] || 0;  // Bottom-right
    const ws21 = data.windspeed[latIdx + 1]?.[lonIdx] || 0;  // Top-left
    const ws22 = data.windspeed[latIdx + 1]?.[lonIdx + 1] || 0; // Top-right

    // Wind direction at 4 corners
    const wd11 = data.winddirection[latIdx]?.[lonIdx] || 0;
    const wd12 = data.winddirection[latIdx]?.[lonIdx + 1] || 0;
    const wd21 = data.winddirection[latIdx + 1]?.[lonIdx] || 0;
    const wd22 = data.winddirection[latIdx + 1]?.[lonIdx + 1] || 0;

    // Temperature at 4 corners
    const temp11 = data.temperature[latIdx]?.[lonIdx] || 0;
    const temp12 = data.temperature[latIdx]?.[lonIdx + 1] || 0;
    const temp21 = data.temperature[latIdx + 1]?.[lonIdx] || 0;
    const temp22 = data.temperature[latIdx + 1]?.[lonIdx + 1] || 0;

    // Interpolation weights
    const latWeight = (targetLat - lat1) / (lat2 - lat1);
    const lonWeight = (targetLon - lon1) / (lon2 - lon1);

    // Interpolate wind speed (simple bilinear)
    const windspeed =
      ws11 * (1 - latWeight) * (1 - lonWeight) +
      ws12 * (1 - latWeight) * lonWeight +
      ws21 * latWeight * (1 - lonWeight) +
      ws22 * latWeight * lonWeight;

    // Interpolate wind direction (circular averaging)
    const winddirection = this.interpolateAngles(
      [wd11, wd12, wd21, wd22],
      [
        (1 - latWeight) * (1 - lonWeight),
        (1 - latWeight) * lonWeight,
        latWeight * (1 - lonWeight),
        latWeight * lonWeight
      ]
    );

    // Interpolate temperature (simple bilinear)
    const temperature =
      temp11 * (1 - latWeight) * (1 - lonWeight) +
      temp12 * (1 - latWeight) * lonWeight +
      temp21 * latWeight * (1 - lonWeight) +
      temp22 * latWeight * lonWeight;

    return {
      windspeed_kmh: windspeed,
      winddirection_deg: winddirection,
      temperature_c: temperature,
      altitude_m: data.geopotential_height?.[latIdx]?.[lonIdx] || null
    };
  }

  /**
   * Interpolate wind directions (circular averaging)
   * @param {Array} angles - Array of wind directions in degrees
   * @param {Array} weights - Array of interpolation weights
   * @returns {number} Interpolated wind direction
   */
  interpolateAngles(angles, weights) {
    let sinSum = 0, cosSum = 0;

    angles.forEach((angle, i) => {
      const rad = angle * Math.PI / 180;
      sinSum += Math.sin(rad) * weights[i];
      cosSum += Math.cos(rad) * weights[i];
    });

    let result = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
    if (result < 0) result += 360;

    return result;
  }
}
