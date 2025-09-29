// aircraft-types.js
// Data models and interfaces for aircraft tracking system

/**
 * Raw aircraft state data from OpenSky Network API
 */
export class AircraftState {
  constructor(data) {
    // OpenSky Network data format:
    // [icao24, callsign, origin_country, time_position, last_contact,
    //  longitude, latitude, baro_altitude, on_ground, velocity,
    //  true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]

    this.icao24 = data[0]; // Unique aircraft identifier
    this.callsign = data[1]?.trim() || null; // Flight callsign/registration
    this.originCountry = data[2]; // Country of registration
    this.timePosition = data[3]; // Unix timestamp of position
    this.lastContact = data[4]; // Unix timestamp of last contact
    this.longitude = data[5]; // WGS84 longitude
    this.latitude = data[6]; // WGS84 latitude
    this.baroAltitude = data[7]; // Barometric altitude (meters)
    this.onGround = data[8]; // Ground contact status
    this.velocity = data[9]; // Ground speed (m/s)
    this.trueTrack = data[10]; // Aircraft heading (degrees)
    this.verticalRate = data[11]; // Climb/descent rate (m/s)
    this.sensors = data[12]; // Sensor data array
    this.geoAltitude = data[13]; // GPS altitude (meters)
    this.squawk = data[14]; // Transponder code
    this.spi = data[15]; // Special purpose indicator
    this.positionSource = data[16]; // Position source (0=ADS-B, 1=ASTERIX, 2=MLAT)
  }

  /**
   * Check if aircraft has valid position data
   */
  hasValidPosition() {
    return (
      this.longitude !== null &&
      this.latitude !== null &&
      !isNaN(this.longitude) &&
      !isNaN(this.latitude)
    );
  }

  /**
   * Check if aircraft data is recent (within last 30 seconds)
   */
  isRecent(maxAgeSeconds = 30) {
    const now = Math.floor(Date.now() / 1000);
    return now - this.lastContact <= maxAgeSeconds;
  }

  /**
   * Get preferred altitude (GPS if available, otherwise barometric)
   */
  getAltitude() {
    return this.geoAltitude !== null ? this.geoAltitude : this.baroAltitude;
  }
}

/**
 * Aircraft category definitions for classification and visualization
 */
export const AircraftCategories = {
  COMMERCIAL_AIRLINER: {
    id: "commercial",
    name: "Commercial Airliner",
    color: "#FECA57",
    icon: "✈️",
    size: 1.5,
    patterns: ["A3", "B7", "A32", "B73", "A33", "A35", "B77", "B78", "A38"],
    callsignPatterns: [/^[A-Z]{3}\d+/, /^[A-Z]{2}\d+/], // Airline codes
  },

  GENERAL_AVIATION: {
    id: "general",
    name: "General Aviation",
    color: "#4ECDC4",
    icon: "🛩️",
    size: 1.0,
    patterns: ["C1", "PA", "SR", "BE", "P28", "C17", "C20", "C25"],
    callsignPatterns: [/^N\d+[A-Z]*/, /^G-[A-Z]+/, /^D-[A-Z]+/], // Private registrations
  },

  HELICOPTER: {
    id: "helicopter",
    name: "Helicopter",
    color: "#45B7D1",
    icon: "🚁",
    size: 1.0,
    patterns: ["R44", "H12", "EC1", "AS3", "B06", "S76", "AW1"],
    callsignPatterns: [/HEMS/, /POLICE/, /RESCUE/],
  },

  LIGHT_AIRCRAFT: {
    id: "light",
    name: "Light Aircraft",
    color: "#96CEB4",
    icon: "🛩️",
    size: 0.8,
    patterns: ["GLID", "UL", "GYRO"],
    callsignPatterns: [/^GLIDER/, /^ULTRA/],
  },

  MILITARY: {
    id: "military",
    name: "Military/Government",
    color: "#FF6B6B",
    icon: "✈️",
    size: 1.3,
    patterns: ["F16", "F18", "C13", "KC1", "E3", "P8"],
    callsignPatterns: [/^[A-Z]+\d{2,4}$/, /AIR FORCE/, /NAVY/],
  },

  UNKNOWN: {
    id: "unknown",
    name: "Unknown/Unclassified",
    color: "#95A5A6",
    icon: "❓",
    size: 1.0,
    patterns: [],
    callsignPatterns: [],
  },
};

/**
 * Position data for aircraft trail visualization
 */
export class Position3D {
  constructor(longitude, latitude, altitude, timestamp = Date.now()) {
    this.longitude = longitude;
    this.latitude = latitude;
    this.altitude = altitude;
    this.timestamp = timestamp;
  }

  /**
   * Calculate distance to another position in meters
   */
  distanceTo(other) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (this.latitude * Math.PI) / 180;
    const φ2 = (other.latitude * Math.PI) / 180;
    const Δφ = ((other.latitude - this.latitude) * Math.PI) / 180;
    const Δλ = ((other.longitude - this.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

/**
 * Processed aircraft data with enhanced information
 */
export class ProcessedAircraft extends AircraftState {
  constructor(aircraftState, category = null) {
    // Create a proper AircraftState instance first
    if (aircraftState instanceof AircraftState) {
      // If already an AircraftState, copy its raw data
      const rawData = [
        aircraftState.icao24,
        aircraftState.callsign,
        aircraftState.originCountry,
        aircraftState.timePosition,
        aircraftState.lastContact,
        aircraftState.longitude,
        aircraftState.latitude,
        aircraftState.baroAltitude,
        aircraftState.onGround,
        aircraftState.velocity,
        aircraftState.trueTrack,
        aircraftState.verticalRate,
        aircraftState.sensors,
        aircraftState.geoAltitude,
        aircraftState.squawk,
        aircraftState.spi,
        aircraftState.positionSource,
      ];
      super(rawData);
    } else {
      // If raw data array, pass directly to parent
      super(aircraftState);
    }

    // Enhanced processing
    this.aircraftType = category || AircraftCategories.UNKNOWN;
    this.displayColor = this.aircraftType.color;
    this.displayIcon = this.aircraftType.icon;
    this.displaySize = this.aircraftType.size;

    // Convert units for display
    const altitude = this.getAltitude();
    this.altitudeFeet = altitude ? Math.round(altitude * 3.28084) : null;
    this.speedKnots = this.velocity
      ? Math.round(this.velocity * 1.94384)
      : null;
    this.lastSeen = new Date(this.lastContact * 1000);

    // Flight trail (limited to 20 positions)
    this.trail = [];
    if (this.hasValidPosition()) {
      this.trail.push(new Position3D(this.longitude, this.latitude, altitude));
    }

    // Tracking metadata
    this.firstSeen = this.lastSeen;
    this.updateCount = 1;
    this.isSelected = false;
    this.isHighlighted = false;
  }

  /**
   * Update aircraft with new state data
   */
  updateState(newState) {
    const oldAltitude = this.getAltitude();
    const oldPosition = this.hasValidPosition()
      ? new Position3D(this.longitude, this.latitude, oldAltitude)
      : null;

    // Update state properties from newState
    if (newState instanceof AircraftState) {
      // Copy properties from AircraftState instance
      this.icao24 = newState.icao24;
      this.callsign = newState.callsign;
      this.originCountry = newState.originCountry;
      this.timePosition = newState.timePosition;
      this.lastContact = newState.lastContact;
      this.longitude = newState.longitude;
      this.latitude = newState.latitude;
      this.baroAltitude = newState.baroAltitude;
      this.onGround = newState.onGround;
      this.velocity = newState.velocity;
      this.trueTrack = newState.trueTrack;
      this.verticalRate = newState.verticalRate;
      this.sensors = newState.sensors;
      this.geoAltitude = newState.geoAltitude;
      this.squawk = newState.squawk;
      this.spi = newState.spi;
      this.positionSource = newState.positionSource;
    } else {
      // Update from raw properties
      Object.assign(this, newState);
    }

    // Update processed fields
    const newAltitude = this.getAltitude();
    this.altitudeFeet = newAltitude ? Math.round(newAltitude * 3.28084) : null;
    this.speedKnots = this.velocity
      ? Math.round(this.velocity * 1.94384)
      : null;
    this.lastSeen = new Date(this.lastContact * 1000);
    this.updateCount++;

    // Update trail if position changed significantly
    if (this.hasValidPosition()) {
      const newPosition = new Position3D(
        this.longitude,
        this.latitude,
        newAltitude
      );

      // Only add to trail if moved more than 100 meters
      if (!oldPosition || oldPosition.distanceTo(newPosition) > 100) {
        this.trail.push(newPosition);

        // Maintain trail length limit (20 positions)
        if (this.trail.length > 20) {
          this.trail.shift();
        }
      }
    }
  }

  /**
   * Get formatted altitude string
   */
  getFormattedAltitude() {
    if (!this.getAltitude()) return "Unknown";
    return `${this.altitudeFeet}ft (${Math.round(this.getAltitude())}m)`;
  }

  /**
   * Get formatted speed string
   */
  getFormattedSpeed() {
    if (!this.velocity) return "Unknown";
    return `${this.speedKnots}kts (${Math.round(this.velocity * 3.6)}km/h)`;
  }

  /**
   * Get formatted heading string
   */
  getFormattedHeading() {
    if (this.trueTrack === null) return "Unknown";
    return `${Math.round(this.trueTrack)}°`;
  }

  /**
   * Get time since last contact
   */
  getTimeSinceContact() {
    const now = Date.now();
    const diffSeconds = Math.floor((now - this.lastSeen.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  }

  /**
   * Check if aircraft should be considered active
   */
  isActive(maxAgeSeconds = 300) {
    // 5 minutes default
    const now = Date.now();
    const ageSeconds = (now - this.lastSeen.getTime()) / 1000;
    return ageSeconds <= maxAgeSeconds;
  }

  /**
   * Get aircraft status for display
   */
  getStatus() {
    if (this.onGround) return "On Ground";
    if (!this.isActive()) return "Lost Contact";
    if (this.verticalRate > 2) return "Climbing";
    if (this.verticalRate < -2) return "Descending";
    return "Level Flight";
  }
}

/**
 * Basic airspace violation data structure
 */
export class AirspaceViolation {
  constructor(aircraft, airspace, violationType = "ENTRY") {
    this.id = `${aircraft.icao24}_${airspace.id}_${Date.now()}`;
    this.aircraftIcao24 = aircraft.icao24;
    this.airspaceId = airspace.id;
    this.timestamp = new Date();
    this.violationType = violationType; // ENTRY, EXIT, ONGOING
    this.aircraftData = aircraft;
    this.airspaceData = airspace;
    this.resolved = false;
  }

  /**
   * Mark violation as resolved
   */
  resolve() {
    this.resolved = true;
    this.resolvedAt = new Date();
  }

  /**
   * Get formatted violation message
   */
  getMessage() {
    const aircraftId = this.aircraftData.callsign || this.aircraftData.icao24;
    return `Aircraft ${aircraftId} ${this.violationType.toLowerCase()} restricted airspace ${
      this.airspaceData.name
    }`;
  }
}

/**
 * Configuration object for aircraft system
 */
export const AircraftConfig = {
  // Update settings (fixed for v1.0)
  updateInterval: 30000, // 30 seconds (fixed)
  maxAircraft: 100, // maximum aircraft to display
  trailLength: 20, // maximum trail positions

  // Visual settings
  showLabels: true,
  showTrails: false,
  labelMinZoom: 50000, // minimum zoom to show labels

  // Filter defaults
  enabledTypes: ["all"], // aircraft types to show
  altitudeFilter: {
    min: 0,
    max: 50000, // 50,000 feet
  },
  speedFilter: {
    min: 0,
    max: 1000, // 1000 knots
  },

  // Performance settings
  lod: {
    high: 100000, // high detail distance (meters)
    low: 500000, // low detail distance
  },

  // API settings
  openSky: {
    baseUrl: "https://opensky-network.org/api/states/all",
    rateLimit: 400, // requests per day (anonymous)
    timeout: 10000, // 10 second timeout
    retryAttempts: 3,
  },
};
