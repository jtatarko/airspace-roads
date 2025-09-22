// airspace-violation-detector.js
// Basic airspace violation detection system

import { AirspaceViolation } from './aircraft-types.js';
import { Cartesian3, Cartographic, Math as CesiumMath } from 'cesium';

/**
 * Airspace violation detection system
 * Performs basic point-in-polygon testing for aircraft vs restricted airspace
 */
export class AirspaceViolationDetector {
    constructor(airspaceVisualizer) {
        this.airspaceVisualizer = airspaceVisualizer;

        // Violation tracking
        this.activeViolations = new Map(); // icao24 + airspaceId -> AirspaceViolation
        this.violationHistory = [];
        this.maxHistoryLength = 1000;

        // Detection settings
        this.enabled = true;
        this.checkInterval = 5000; // Check every 5 seconds
        this.alertThreshold = 3; // Alert after 3 consecutive checks

        // Restricted airspace types that trigger violations (using icaoClass values)
        this.restrictedTypes = new Set([
            8, // Danger areas (icaoClass: 8)
            // Note: Other restricted areas would be identified by name patterns or restriction flags
        ]);

        // Violation event handlers
        this.eventHandlers = {
            onViolationDetected: null,
            onViolationResolved: null,
            onAlert: null
        };

        console.log('Airspace Violation Detector initialized');
    }

    /**
     * Check aircraft for airspace violations
     * @param {ProcessedAircraft[]} aircraft - Array of aircraft to check
     */
    checkViolations(aircraft) {
        if (!this.enabled || !this.airspaceVisualizer) {
            return;
        }

        const airspaces = this.airspaceVisualizer.airspaces;
        if (!airspaces || airspaces.length === 0) {
            return;
        }

        const currentTime = new Date();
        const newViolations = [];
        const resolvedViolations = [];
        const activeViolationKeys = new Set();

        // Check each aircraft against all airspaces
        for (const ac of aircraft) {
            if (!ac.hasValidPosition() || !ac.isActive()) {
                continue;
            }

            // Check against each airspace
            for (const airspace of airspaces) {
                if (!this.isRestrictedAirspace(airspace)) {
                    continue;
                }

                const violationKey = `${ac.icao24}_${airspace.id}`;
                const isInside = this.isAircraftInAirspace(ac, airspace);

                if (isInside) {
                    activeViolationKeys.add(violationKey);

                    // Check if this is a new violation
                    if (!this.activeViolations.has(violationKey)) {
                        const violation = new AirspaceViolation(ac, airspace, 'ENTRY');
                        this.activeViolations.set(violationKey, violation);
                        newViolations.push(violation);

                        this.addToHistory(violation);

                        console.warn(`Airspace violation detected: ${ac.callsign || ac.icao24} entered ${airspace.name}`);
                    }
                }
            }
        }

        // Check for resolved violations
        for (const [violationKey, violation] of this.activeViolations) {
            if (!activeViolationKeys.has(violationKey)) {
                violation.resolve();
                resolvedViolations.push(violation);
                this.activeViolations.delete(violationKey);

                console.log(`Airspace violation resolved: ${violation.aircraftData.callsign || violation.aircraftData.icao24} exited ${violation.airspaceData.name}`);
            }
        }

        // Fire events
        this.fireViolationEvents(newViolations, resolvedViolations);

        // Update visual alerts
        this.updateVisualAlerts();
    }

    /**
     * Check if airspace is restricted and should trigger violations
     * @param {Object} airspace - Airspace data
     * @returns {boolean} Whether airspace is restricted
     */
    isRestrictedAirspace(airspace) {
        // Check by ICAO class (primary method)
        if (this.restrictedTypes.has(airspace.icaoClass)) {
            return true;
        }

        // Check restrictions flags
        const restrictions = airspace.restrictions || {};
        if (restrictions.byNotam || restrictions.specialAgreement) {
            return true;
        }

        // Check if it's a restricted area by name (fallback)
        const name = airspace.name?.toUpperCase() || '';
        if (name.includes('RESTRICTED') ||
            name.includes('PROHIBITED') ||
            name.includes('DANGER') ||
            name.includes('MILITARY')) {
            return true;
        }

        return false;
    }

    /**
     * Check if aircraft is inside airspace using point-in-polygon algorithm
     * @param {ProcessedAircraft} aircraft - Aircraft data
     * @param {Object} airspace - Airspace data
     * @returns {boolean} Whether aircraft is inside airspace
     */
    isAircraftInAirspace(aircraft, airspace) {
        // Check altitude first (quick elimination)
        if (!this.isAircraftInAltitudeRange(aircraft, airspace)) {
            return false;
        }

        // Check horizontal position using ray casting algorithm
        return this.pointInPolygon(
            aircraft.latitude,
            aircraft.longitude,
            airspace.coordinates
        );
    }

    /**
     * Check if aircraft is within airspace altitude range
     * @param {ProcessedAircraft} aircraft - Aircraft data
     * @param {Object} airspace - Airspace data
     * @returns {boolean} Whether aircraft is in altitude range
     */
    isAircraftInAltitudeRange(aircraft, airspace) {
        const aircraftAltitude = aircraft.getAltitude();
        if (aircraftAltitude === null) {
            return false; // Can't determine altitude
        }

        // Convert aircraft altitude to feet for comparison
        const aircraftAltitudeFt = aircraftAltitude * 3.28084;

        // Get airspace altitude limits
        const lowerLimit = this.parseAltitude(airspace.lowerAltitude, airspace.isLowerAGL);
        const upperLimit = this.parseAltitude(airspace.upperAltitude, airspace.isUpperAGL);

        // Check if aircraft is within range
        return aircraftAltitudeFt >= lowerLimit && aircraftAltitudeFt <= upperLimit;
    }

    /**
     * Parse altitude string to numeric value in feet
     * @param {string} altitudeStr - Altitude string (e.g., "5000FT", "FL100")
     * @param {boolean} isAGL - Whether altitude is Above Ground Level
     * @returns {number} Altitude in feet
     */
    parseAltitude(altitudeStr, isAGL = false) {
        if (!altitudeStr) return 0;

        const str = altitudeStr.toString().toUpperCase();

        // Flight Level (FL100 = 10,000ft)
        if (str.startsWith('FL')) {
            const fl = parseInt(str.substring(2));
            return fl * 100;
        }

        // Extract numeric value
        const match = str.match(/(\d+)/);
        if (!match) return 0;

        let altitude = parseInt(match[1]);

        // Convert meters to feet if needed
        if (str.includes('M') && !str.includes('FT')) {
            altitude = altitude * 3.28084;
        }

        // For AGL altitudes, we assume worst case (add typical terrain height)
        if (isAGL) {
            altitude += 1000; // Add 1000ft for typical terrain elevation
        }

        return altitude;
    }

    /**
     * Point-in-polygon algorithm using ray casting
     * @param {number} lat - Point latitude
     * @param {number} lon - Point longitude
     * @param {Array} polygon - Array of [lon, lat] coordinates
     * @returns {boolean} Whether point is inside polygon
     */
    pointInPolygon(lat, lon, polygon) {
        if (!polygon || polygon.length < 3) {
            return false;
        }

        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i][1]; // latitude
            const yi = polygon[i][0]; // longitude
            const xj = polygon[j][1]; // latitude
            const yj = polygon[j][0]; // longitude

            if (((yi > lon) !== (yj > lon)) &&
                (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Add violation to history
     * @param {AirspaceViolation} violation - Violation to add
     */
    addToHistory(violation) {
        this.violationHistory.push(violation);

        // Maintain history length limit
        if (this.violationHistory.length > this.maxHistoryLength) {
            this.violationHistory.shift();
        }
    }

    /**
     * Fire violation events
     * @param {AirspaceViolation[]} newViolations - New violations
     * @param {AirspaceViolation[]} resolvedViolations - Resolved violations
     */
    fireViolationEvents(newViolations, resolvedViolations) {
        // New violations
        for (const violation of newViolations) {
            if (this.eventHandlers.onViolationDetected) {
                this.eventHandlers.onViolationDetected(violation);
            }

            // Check if this should trigger an alert
            if (this.shouldAlert(violation)) {
                if (this.eventHandlers.onAlert) {
                    this.eventHandlers.onAlert(violation);
                }

                // Browser notification if permitted
                this.showBrowserNotification(violation);
            }
        }

        // Resolved violations
        for (const violation of resolvedViolations) {
            if (this.eventHandlers.onViolationResolved) {
                this.eventHandlers.onViolationResolved(violation);
            }
        }
    }

    /**
     * Check if violation should trigger an alert
     * @param {AirspaceViolation} violation - Violation to check
     * @returns {boolean} Whether to alert
     */
    shouldAlert(violation) {
        // Always alert for prohibited areas
        if (violation.airspaceData.icaoClass === 'P' ||
            violation.airspaceData.name?.toUpperCase().includes('PROHIBITED')) {
            return true;
        }

        // Alert for danger areas
        if (violation.airspaceData.icaoClass === 'D' ||
            violation.airspaceData.name?.toUpperCase().includes('DANGER')) {
            return true;
        }

        // Alert for military areas
        if (violation.airspaceData.name?.toUpperCase().includes('MILITARY')) {
            return true;
        }

        return false;
    }

    /**
     * Show browser notification for violation
     * @param {AirspaceViolation} violation - Violation to notify about
     */
    showBrowserNotification(violation) {
        if (!('Notification' in window)) {
            return;
        }

        if (Notification.permission === 'granted') {
            const notification = new Notification('Airspace Violation Detected', {
                body: violation.getMessage(),
                icon: '✈️',
                requireInteraction: true
            });

            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);

        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showBrowserNotification(violation);
                }
            });
        }
    }

    /**
     * Update visual alerts for active violations
     */
    updateVisualAlerts() {
        if (!this.airspaceVisualizer) return;

        // Reset all airspace highlighting
        for (const airspace of this.airspaceVisualizer.airspaces) {
            this.airspaceVisualizer.unhighlightAirspace(airspace.id);
        }

        // Highlight airspaces with violations
        const violatedAirspaces = new Set();
        for (const violation of this.activeViolations.values()) {
            violatedAirspaces.add(violation.airspaceData.id);
        }

        for (const airspaceId of violatedAirspaces) {
            this.airspaceVisualizer.highlightAirspace(airspaceId, true);
        }
    }

    /**
     * Get current violation statistics
     * @returns {Object} Violation statistics
     */
    getStatistics() {
        return {
            activeViolations: this.activeViolations.size,
            totalViolations: this.violationHistory.length,
            violationsByType: this.getViolationsByType(),
            violationsByAirspace: this.getViolationsByAirspace(),
            recentViolations: this.getRecentViolations(24) // Last 24 hours
        };
    }

    /**
     * Get violations grouped by type
     */
    getViolationsByType() {
        const byType = {};

        for (const violation of this.violationHistory) {
            const type = violation.airspaceData.icaoClass || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        }

        return byType;
    }

    /**
     * Get violations grouped by airspace
     */
    getViolationsByAirspace() {
        const byAirspace = {};

        for (const violation of this.violationHistory) {
            const name = violation.airspaceData.name;
            byAirspace[name] = (byAirspace[name] || 0) + 1;
        }

        return byAirspace;
    }

    /**
     * Get recent violations within specified hours
     * @param {number} hours - Hours to look back
     * @returns {AirspaceViolation[]} Recent violations
     */
    getRecentViolations(hours = 24) {
        const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));

        return this.violationHistory.filter(violation =>
            violation.timestamp >= cutoff
        );
    }

    /**
     * Get active violations
     * @returns {AirspaceViolation[]} Active violations
     */
    getActiveViolations() {
        return Array.from(this.activeViolations.values());
    }

    /**
     * Clear violation history
     */
    clearHistory() {
        this.violationHistory = [];
        console.log('Violation history cleared');
    }

    /**
     * Enable/disable violation detection
     * @param {boolean} enabled - Whether to enable detection
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        if (!enabled) {
            // Clear active violations and visual alerts
            this.activeViolations.clear();
            this.updateVisualAlerts();
        }

        console.log(`Violation detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set restricted airspace types
     * @param {Set|Array} types - Set or array of restricted types
     */
    setRestrictedTypes(types) {
        this.restrictedTypes = new Set(types);
        console.log('Restricted airspace types updated:', Array.from(this.restrictedTypes));
    }

    /**
     * Event handler registration
     */
    onViolationDetected(callback) {
        this.eventHandlers.onViolationDetected = callback;
    }

    onViolationResolved(callback) {
        this.eventHandlers.onViolationResolved = callback;
    }

    onAlert(callback) {
        this.eventHandlers.onAlert = callback;
    }

    /**
     * Destroy detector and cleanup
     */
    destroy() {
        this.activeViolations.clear();
        this.violationHistory = [];
        this.eventHandlers = {};

        console.log('Airspace Violation Detector destroyed');
    }
}