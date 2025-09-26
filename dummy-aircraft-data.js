// dummy-aircraft-data.js
// Generates realistic dummy aircraft data for testing and development

import { AircraftCategories } from "./aircraft-types.js";

/**
 * Dummy aircraft data generator for testing without OpenSky API calls
 */
export class DummyAircraftGenerator {
  constructor() {
    // Base location for aircraft generation (can be adjusted)
    this.baseLocation = {
      latitude: 46.0, // Slovenia area (matches main.js camera)
      longitude: 14.5,
      radius: 0.5, // Degrees (~55km radius)
    };

    // Generated aircraft storage
    this.aircraft = new Map();

    // Movement simulation
    this.lastUpdate = Date.now();
    this.updateInterval = 1000; // 30 seconds like real API
  }

  /**
   * Generate initial dummy aircraft fleet
   */
  generateInitialFleet(count = 15) {
    const aircraftTypes = Object.values(AircraftCategories);

    for (let i = 0; i < count; i++) {
      const icao24 = this.generateICAO24();
      const aircraftType = aircraftTypes[i % aircraftTypes.length];
      const aircraft = this.createDummyAircraft(icao24, aircraftType, i);
      this.aircraft.set(icao24, aircraft);
    }

    console.log(`Generated ${count} dummy aircraft for testing`);
    return this.getCurrentStates();
  }

  /**
   * Create a single dummy aircraft with realistic data
   */
  createDummyAircraft(icao24, category, index) {
    const isOnGround = Math.random() < 0.15; // 15% on ground
    const altitude = isOnGround ? 0 : Math.floor(Math.random() * 35000) + 5000; // 5k-40k feet

    const speed = isOnGround
      ? Math.random() * 20 // 0-20 m/s on ground
      : Math.random() * 200 + 100; // 100-300 m/s airborne

    // Generate position within radius of base location
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * this.baseLocation.radius;
    const lat = this.baseLocation.latitude + distance * Math.cos(angle);
    const lng = this.baseLocation.longitude + distance * Math.sin(angle);

    // Generate realistic callsign based on category
    const callsign = this.generateCallsign(category, index);

    const heading = Math.floor(Math.random() * 360);
    const verticalRate = isOnGround ? 0 : (Math.random() - 0.5) * 10; // -5 to +5 m/s

    const now = Math.floor(Date.now() / 1000);

    // OpenSky API format (17 elements)
    return [
      icao24, // [0] icao24
      callsign, // [1] callsign
      "Unknown", // [2] origin_country
      now - Math.floor(Math.random() * 10), // [3] time_position
      now, // [4] last_contact
      lng, // [5] longitude
      lat, // [6] latitude
      altitude * 0.3048, // [7] baro_altitude (convert ft to meters)
      isOnGround, // [8] on_ground
      speed, // [9] velocity
      heading, // [10] true_track
      verticalRate, // [11] vertical_rate
      null, // [12] sensors
      altitude * 0.3048, // [13] geo_altitude
      "2000", // [14] squawk
      false, // [15] spi
      0, // [16] position_source
    ];
  }

  /**
   * Generate realistic ICAO24 identifier
   */
  generateICAO24() {
    const chars = "0123456789ABCDEF";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result.toLowerCase();
  }

  /**
   * Generate realistic callsign based on aircraft category
   */
  generateCallsign(category, index) {
    const patterns = {
      commercial: ["UAL", "DAL", "AAL", "SWA", "JBU", "ASA", "FFT", "SKW"],
      general: ["N123AB", "N456CD", "N789EF", "N012GH", "N345IJ"],
      helicopter: ["HEMS1", "POLICE", "RESCUE", "N911HP", "N200MD"],
      military: ["USAF01", "NAVY02", "ARMY03", "GUARD04", "RESCUE"],
      light: ["N99GL", "GLIDER", "N77UL", "ULTRA1", "N88SP"],
    };

    const categoryPatterns = patterns[category.id] || patterns.general;

    if (category.id === "commercial") {
      const airline = categoryPatterns[index % categoryPatterns.length];
      const flightNum = Math.floor(Math.random() * 9000) + 1000;
      return `${airline}${flightNum}`;
    }

    return categoryPatterns[index % categoryPatterns.length];
  }

  /**
   * Update aircraft positions to simulate movement
   */
  updatePositions() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // seconds

    for (const [icao24, aircraftData] of this.aircraft) {
      // Skip if on ground
      if (aircraftData[8]) continue;

      const speed = aircraftData[9]; // m/s
      const heading = aircraftData[10]; // degrees
      const currentLat = aircraftData[6];
      const currentLng = aircraftData[5];

      // Calculate movement (simplified)
      const distanceKm = (speed * deltaTime) / 1000;
      const headingRad = (heading * Math.PI) / 180;

      // Update position (approximate)
      const deltaLat = (distanceKm * Math.cos(headingRad)) / 111; // ~111km per degree
      const deltaLng =
        (distanceKm * Math.sin(headingRad)) /
        (111 * Math.cos((currentLat * Math.PI) / 180));

      aircraftData[6] = currentLat + deltaLat; // latitude
      aircraftData[5] = currentLng + deltaLng; // longitude
      aircraftData[4] = Math.floor(now / 1000); // last_contact

      // Occasionally change heading (realistic flight path variations)
      if (Math.random() < 0.1) {
        // 10% chance
        aircraftData[10] += (Math.random() - 0.5) * 20; // ±10 degree change
        aircraftData[10] = (aircraftData[10] + 360) % 360; // normalize
      }
    }

    this.lastUpdate = now;
  }

  /**
   * Get current aircraft states in OpenSky API format
   */
  getCurrentStates() {
    this.updatePositions();

    return {
      time: Math.floor(Date.now() / 1000),
      states: Array.from(this.aircraft.values()),
    };
  }

  /**
   * Add new aircraft dynamically
   */
  addAircraft(count = 1) {
    const aircraftTypes = Object.values(AircraftCategories);

    for (let i = 0; i < count; i++) {
      const icao24 = this.generateICAO24();
      const aircraftType =
        aircraftTypes[Math.floor(Math.random() * aircraftTypes.length)];
      const aircraft = this.createDummyAircraft(
        icao24,
        aircraftType,
        this.aircraft.size
      );
      this.aircraft.set(icao24, aircraft);
    }

    console.log(`Added ${count} dummy aircraft`);
  }

  /**
   * Remove aircraft by ICAO24
   */
  removeAircraft(icao24) {
    this.aircraft.delete(icao24);
    console.log(`Removed aircraft ${icao24}`);
  }

  /**
   * Get statistics about current dummy fleet
   */
  getStats() {
    const total = this.aircraft.size;
    let onGround = 0;
    const categories = {};

    for (const aircraftData of this.aircraft.values()) {
      if (aircraftData[8]) onGround++;

      // Count by estimated category (simplified)
      const callsign = aircraftData[1];
      let category = "unknown";
      if (callsign.match(/^[A-Z]{3}\d+/)) category = "commercial";
      else if (callsign.includes("N")) category = "general";
      else if (callsign.includes("HEMS|POLICE|RESCUE")) category = "helicopter";
      else if (callsign.includes("USAF|NAVY|ARMY")) category = "military";

      categories[category] = (categories[category] || 0) + 1;
    }

    return {
      total,
      airborne: total - onGround,
      onGround,
      categories,
    };
  }
}

// Create singleton instance
export const dummyAircraftGenerator = new DummyAircraftGenerator();
