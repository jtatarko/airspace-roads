// aircraft-api-service.js
// OpenSky Network API integration service with rate limiting and error handling

import { AircraftState, AircraftConfig } from "./aircraft-types.js";

/**
 * Service for fetching aircraft data from OpenSky Network API
 */
export class AircraftAPIService {
  constructor() {
    this.baseUrl = AircraftConfig.openSky.baseUrl;
    this.rateLimit = AircraftConfig.openSky.rateLimit;
    this.timeout = AircraftConfig.openSky.timeout;
    this.retryAttempts = AircraftConfig.openSky.retryAttempts;

    // Rate limiting tracking
    this.requestCount = 0;
    this.dailyLimitReached = false;
    this.lastResetDate = new Date().toDateString();
    this.lastRequestTime = 0;
    this.minRequestInterval = 30000; // 30 seconds minimum between requests

    // Error tracking
    this.consecutiveErrors = 0;
    this.lastError = null;
    this.isOnline = true;

    // Load saved request count from localStorage
    this.loadRequestCount();

    console.log("Aircraft API Service initialized");
  }

  /**
   * Load request count from localStorage to persist across sessions
   */
  loadRequestCount() {
    try {
      const saved = localStorage.getItem("aircraftAPI_requestCount");
      const savedDate = localStorage.getItem("aircraftAPI_date");
      const today = new Date().toDateString();

      if (savedDate === today && saved) {
        this.requestCount = parseInt(saved, 10) || 0;
        console.log(
          `Loaded request count: ${this.requestCount}/${this.rateLimit}`
        );
      } else {
        // New day, reset counter
        this.requestCount = 0;
        this.saveRequestCount();
      }
    } catch (error) {
      console.warn("Failed to load request count from localStorage:", error);
      this.requestCount = 0;
    }
  }

  /**
   * Save request count to localStorage
   */
  saveRequestCount() {
    try {
      localStorage.setItem(
        "aircraftAPI_requestCount",
        this.requestCount.toString()
      );
      localStorage.setItem("aircraftAPI_date", new Date().toDateString());
    } catch (error) {
      console.warn("Failed to save request count to localStorage:", error);
    }
  }

  /**
   * Check if we can make a request without exceeding rate limits
   */
  canMakeRequest() {
    // Check daily limit
    if (this.requestCount >= this.rateLimit) {
      this.dailyLimitReached = true;
      return false;
    }

    // Check minimum interval between requests
    const now = Date.now();
    if (now - this.lastRequestTime < this.minRequestInterval) {
      return false;
    }

    return true;
  }

  /**
   * Get time until next request is allowed
   */
  getTimeUntilNextRequest() {
    if (this.dailyLimitReached) {
      // Time until midnight (daily reset)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    }

    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const timeRemaining = this.minRequestInterval - timeSinceLastRequest;
    return Math.max(0, timeRemaining);
  }

  /**
   * Get API usage statistics
   */
  getUsageStats() {
    return {
      requestsUsed: this.requestCount,
      requestsRemaining: Math.max(0, this.rateLimit - this.requestCount),
      dailyLimit: this.rateLimit,
      dailyLimitReached: this.dailyLimitReached,
      timeUntilNextRequest: this.getTimeUntilNextRequest(),
      consecutiveErrors: this.consecutiveErrors,
      lastError: this.lastError,
      isOnline: this.isOnline,
    };
  }

  /**
   * Fetch aircraft data from OpenSky Network API
   * @param {Object} options - Request options
   * @param {Array} options.bbox - Bounding box [lamin, lomin, lamax, lomax]
   * @param {boolean} options.extended - Whether to include extended data
   * @returns {Promise<AircraftState[]>} Array of aircraft states
   */
  async fetchAircraftData(options = {}) {
    if (!this.canMakeRequest()) {
      const timeRemaining = this.getTimeUntilNextRequest();
      throw new Error(
        this.dailyLimitReached
          ? `Daily API limit reached (${this.rateLimit} requests). Resets at midnight.`
          : `Rate limited. Next request allowed in ${Math.ceil(
              timeRemaining / 1000
            )} seconds.`
      );
    }

    const url = this.buildApiUrl(options);
    console.log(`Fetching aircraft data from: ${url}`);

    let lastError;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.makeRequest(url);

        // Success - reset error counter
        this.consecutiveErrors = 0;
        this.lastError = null;
        this.isOnline = true;

        return this.parseResponse(response);
      } catch (error) {
        lastError = error;
        console.warn(`API request attempt ${attempt} failed:`, error.message);

        // Don't retry on rate limit or authentication errors
        if (
          error.message.includes("rate limit") ||
          error.message.includes("401") ||
          error.message.includes("403")
        ) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    this.consecutiveErrors++;
    this.lastError = lastError;
    this.isOnline = false;

    throw lastError;
  }

  /**
   * Build API URL with parameters
   */
  buildApiUrl(options) {
    const url = new URL(this.baseUrl);

    // Add bounding box if specified
    if (
      options.bbox &&
      Array.isArray(options.bbox) &&
      options.bbox.length === 4
    ) {
      const [lamin, lomin, lamax, lomax] = options.bbox;
      url.searchParams.set("lamin", lamin);
      url.searchParams.set("lomin", lomin);
      url.searchParams.set("lamax", lamax);
      url.searchParams.set("lomax", lomax);
    }

    // Add extended data flag
    if (options.extended) {
      url.searchParams.set("extended", "1");
    }

    return url.toString();
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  async makeRequest(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Track request
      this.requestCount++;
      this.lastRequestTime = Date.now();
      this.saveRequestCount();

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Airspace-Roads-App/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded by OpenSky API");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed or access denied");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Parse API response and convert to AircraftState objects
   */
  parseResponse(response) {
    if (!response || !response.states || !Array.isArray(response.states)) {
      throw new Error("Invalid API response format");
    }

    const aircraft = [];
    const now = Math.floor(Date.now() / 1000);

    for (const stateData of response.states) {
      try {
        const aircraftState = new AircraftState(stateData);

        // Validate essential data
        if (!aircraftState.icao24) {
          console.warn("Skipping aircraft with missing ICAO24");
          continue;
        }

        // Skip aircraft with very old data (older than 5 minutes)
        if (
          aircraftState.lastContact &&
          now - aircraftState.lastContact > 300
        ) {
          continue;
        }

        // Skip aircraft without position data
        if (!aircraftState.hasValidPosition()) {
          continue;
        }

        aircraft.push(aircraftState);
      } catch (error) {
        console.warn("Failed to parse aircraft state:", error);
        continue;
      }
    }

    console.log(
      `Parsed ${aircraft.length} valid aircraft from ${response.states.length} states`
    );
    return aircraft;
  }

  /**
   * Fetch aircraft data for a specific geographic region
   * @param {number} lat - Center latitude
   * @param {number} lon - Center longitude
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Promise<AircraftState[]>} Array of aircraft states
   */
  async fetchAircraftInRegion(lat, lon, radiusKm = 50) {
    // Convert radius to approximate lat/lon bounds
    const latDelta = radiusKm / 111; // 1 degree lat ≈ 111 km
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const bbox = [
      lat - latDelta, // lamin
      lon - lonDelta, // lomin
      lat + latDelta, // lamax
      lon + lonDelta, // lomax
    ];

    return this.fetchAircraftData({ bbox });
  }

  /**
   * Fetch aircraft data for Slovenia region (default area)
   */
  async fetchAircraftInSlovenia() {
    // Slovenia bounding box
    const bbox = [
      45.4, // lamin (southern border)
      13.4, // lomin (western border)
      46.9, // lamax (northern border)
      16.6, // lomax (eastern border)
    ];

    return this.fetchAircraftData({ bbox });
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      console.log("Testing OpenSky API connection...");

      // Make a minimal request to test connectivity
      const aircraft = await this.fetchAircraftInRegion(46.0, 14.5, 25); // Small area around Slovenia

      console.log(`API test successful: ${aircraft.length} aircraft found`);
      return {
        success: true,
        aircraftCount: aircraft.length,
        usageStats: this.getUsageStats(),
      };
    } catch (error) {
      console.error("API test failed:", error);
      return {
        success: false,
        error: error.message,
        usageStats: this.getUsageStats(),
      };
    }
  }

  /**
   * Reset daily usage counter (for testing or manual reset)
   */
  resetDailyCounter() {
    this.requestCount = 0;
    this.dailyLimitReached = false;
    this.saveRequestCount();
    console.log("Daily request counter reset");
  }

  /**
   * Destroy service and cleanup
   */
  destroy() {
    this.saveRequestCount();
    console.log("Aircraft API Service destroyed");
  }
}
