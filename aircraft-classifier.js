// aircraft-classifier.js
// Aircraft classification and visual styling system

import { AircraftCategories, ProcessedAircraft, AircraftConfig } from './aircraft-types.js';
import { Color } from 'cesium';

/**
 * Aircraft classification and visualization styling system
 * Similar to AirspaceClassifier but for aircraft types and categories
 */
export class AircraftClassifier {

    /**
     * Classify aircraft based on ICAO type code and callsign patterns
     * @param {AircraftState} aircraftState - Raw aircraft state data
     * @returns {Object} Aircraft category object
     */
    static classifyAircraft(aircraftState) {
        const callsign = aircraftState.callsign?.trim().toUpperCase() || '';
        const icao24 = aircraftState.icao24?.toUpperCase() || '';

        // Check each category's patterns
        for (const category of Object.values(AircraftCategories)) {
            if (category.id === 'unknown') continue;

            // Check callsign patterns first (more reliable)
            if (this.matchesCallsignPatterns(callsign, category.callsignPatterns)) {
                return category;
            }

            // Check aircraft type patterns (from ICAO type codes)
            if (this.matchesTypePatterns(callsign, category.patterns)) {
                return category;
            }
        }

        // Special classification rules
        if (this.isLikelyMilitary(callsign, icao24)) {
            return AircraftCategories.MILITARY;
        }

        if (this.isLikelyHelicopter(callsign)) {
            return AircraftCategories.HELICOPTER;
        }

        if (this.isLikelyGeneralAviation(callsign, aircraftState)) {
            return AircraftCategories.GENERAL_AVIATION;
        }

        // Default to unknown
        return AircraftCategories.UNKNOWN;
    }

    /**
     * Check if callsign matches any of the given patterns
     */
    static matchesCallsignPatterns(callsign, patterns) {
        if (!callsign || !patterns) return false;

        return patterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(callsign);
            }
            return callsign.includes(pattern);
        });
    }

    /**
     * Check if callsign contains aircraft type patterns
     */
    static matchesTypePatterns(callsign, patterns) {
        if (!callsign || !patterns) return false;

        return patterns.some(pattern => callsign.includes(pattern));
    }

    /**
     * Special rules for military aircraft detection
     */
    static isLikelyMilitary(callsign, icao24) {
        if (!callsign) return false;

        const militaryIndicators = [
            'ARMY', 'NAVY', 'FORCE', 'GUARD', 'RESCUE', 'MILITARY',
            'FIGHTER', 'BOMBER', 'CARGO', 'TANKER', 'RECON'
        ];

        return militaryIndicators.some(indicator => callsign.includes(indicator)) ||
               /^[A-Z]{2,4}\d{2,4}$/.test(callsign); // Military callsign pattern
    }

    /**
     * Special rules for helicopter detection
     */
    static isLikelyHelicopter(callsign) {
        if (!callsign) return false;

        const heliIndicators = ['HELI', 'MEDIC', 'RESCUE', 'POLICE', 'NEWS', 'LIFEFLIGHT'];
        return heliIndicators.some(indicator => callsign.includes(indicator));
    }

    /**
     * Special rules for general aviation detection
     */
    static isLikelyGeneralAviation(callsign, aircraftState) {
        if (!callsign) return false;

        // Private registration patterns (US, Europe, etc.)
        const privatePatterns = [
            /^N\d+[A-Z]*$/,     // US: N12345A
            /^G-[A-Z]+$/,       // UK: G-ABCD
            /^D-[A-Z]+$/,       // Germany: D-ABCD
            /^F-[A-Z]+$/,       // France: F-ABCD
            /^OE-[A-Z]+$/,      // Austria: OE-ABC
            /^S5-[A-Z]+$/       // Slovenia: S5-ABC
        ];

        return privatePatterns.some(pattern => pattern.test(callsign));
    }

    /**
     * Get visualization style for aircraft
     * @param {ProcessedAircraft} aircraft - Processed aircraft data
     * @param {Object} options - Style options
     * @returns {Object} Visualization style object
     */
    static getVisualizationStyle(aircraft, options = {}) {
        const {
            highlighted = false,
            selected = false,
            showLabels = true,
            lod = 'high'
        } = options;

        const category = aircraft.aircraftType;
        const baseColor = Color.fromCssColorString(category.color);

        // Adjust styling based on state
        let fillColor = baseColor;
        let outlineColor = Color.WHITE;
        let size = category.size;
        let opacity = 1.0;

        if (highlighted) {
            fillColor = Color.YELLOW;
            outlineColor = Color.ORANGE;
            size *= 1.3;
        }

        if (selected) {
            outlineColor = Color.CYAN;
            size *= 1.2;
        }

        // Adjust for LOD (Level of Detail)
        if (lod === 'low') {
            size *= 0.7;
            opacity *= 0.8;
        }

        // Aircraft status adjustments
        if (aircraft.onGround) {
            opacity *= 0.6;
            fillColor = Color.fromAlpha(fillColor, 0.6);
        }

        if (!aircraft.isActive()) {
            opacity *= 0.4;
            fillColor = Color.GRAY;
        }

        // Label styling
        const labelStyle = this.getLabelStyle(aircraft, { showLabels, highlighted, selected });

        return {
            // Billboard/Point styling
            fillColor: Color.fromAlpha(fillColor, opacity),
            outlineColor: outlineColor,
            outlineWidth: highlighted || selected ? 2 : 1,
            size: size * 10, // Scale for Cesium billboard
            icon: category.icon,

            // Label styling
            showLabel: showLabels && labelStyle.show,
            labelText: labelStyle.text,
            labelStyle: labelStyle,

            // Trail styling
            trailColor: Color.fromAlpha(fillColor, 0.6),
            trailWidth: 2
        };
    }

    /**
     * Get label styling for aircraft
     */
    static getLabelStyle(aircraft, options = {}) {
        const { showLabels = true, highlighted = false, selected = false } = options;

        if (!showLabels) {
            return { show: false };
        }

        // Determine label text based on available data
        let labelText = aircraft.callsign || aircraft.icao24;

        if (selected || highlighted) {
            // More detailed label for selected/highlighted aircraft
            const altitude = aircraft.getFormattedAltitude();
            const speed = aircraft.getFormattedSpeed();
            labelText += `\n${altitude}\n${speed}`;
        }

        return {
            show: true,
            text: labelText,
            font: highlighted || selected ? '12pt sans-serif' : '10pt sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: 'FILL_AND_OUTLINE',
            pixelOffset: { x: 0, y: -30 }, // Offset above aircraft
            scale: highlighted || selected ? 1.2 : 1.0,
            showBackground: selected,
            backgroundColor: selected ? Color.fromAlpha(Color.BLACK, 0.7) : undefined,
            backgroundPadding: selected ? { x: 7, y: 5 } : undefined
        };
    }

    /**
     * Filter aircraft by various criteria
     * @param {ProcessedAircraft[]} aircraft - Array of aircraft
     * @param {Object} filters - Filter criteria
     * @returns {ProcessedAircraft[]} Filtered aircraft array
     */
    static filterAircraft(aircraft, filters = {}) {
        const {
            types = ['all'],
            altitudeRange = { min: 0, max: 50000 },
            speedRange = { min: 0, max: 1000 },
            onGroundOnly = false,
            activeOnly = true,
            searchTerm = ''
        } = filters;

        return aircraft.filter(a => {
            // Type filter
            if (!types.includes('all') && !types.includes(a.aircraftType.id)) {
                return false;
            }

            // Altitude filter (in feet)
            if (a.altitudeFeet !== null) {
                if (a.altitudeFeet < altitudeRange.min || a.altitudeFeet > altitudeRange.max) {
                    return false;
                }
            }

            // Speed filter (in knots)
            if (a.speedKnots !== null) {
                if (a.speedKnots < speedRange.min || a.speedKnots > speedRange.max) {
                    return false;
                }
            }

            // Ground filter
            if (onGroundOnly && !a.onGround) {
                return false;
            }

            // Active filter
            if (activeOnly && !a.isActive()) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const callsign = (a.callsign || '').toLowerCase();
                const icao24 = a.icao24.toLowerCase();
                const country = a.originCountry.toLowerCase();

                if (!callsign.includes(term) &&
                    !icao24.includes(term) &&
                    !country.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Get legend data for aircraft categories
     * @returns {Array} Legend data array
     */
    static getLegendData() {
        return Object.values(AircraftCategories).map(category => ({
            id: category.id,
            name: category.name,
            color: category.color,
            hexColor: category.color,
            icon: category.icon,
            description: this.getCategoryDescription(category.id)
        }));
    }

    /**
     * Get description for aircraft category
     */
    static getCategoryDescription(categoryId) {
        const descriptions = {
            commercial: 'Commercial airliners and passenger flights',
            general: 'Private aircraft and general aviation',
            helicopter: 'Rotorcraft including emergency and news helicopters',
            light: 'Light aircraft, gliders, and ultralights',
            military: 'Military and government aircraft',
            unknown: 'Unclassified or unidentified aircraft'
        };

        return descriptions[categoryId] || 'Unknown category';
    }

    /**
     * Get aircraft statistics by category
     * @param {ProcessedAircraft[]} aircraft - Array of aircraft
     * @returns {Object} Statistics object
     */
    static getStatistics(aircraft) {
        const stats = {
            total: aircraft.length,
            active: aircraft.filter(a => a.isActive()).length,
            onGround: aircraft.filter(a => a.onGround).length,
            inFlight: aircraft.filter(a => !a.onGround && a.isActive()).length,
            byCategory: {},
            altitudeStats: this.getAltitudeStatistics(aircraft),
            speedStats: this.getSpeedStatistics(aircraft)
        };

        // Count by category
        Object.values(AircraftCategories).forEach(category => {
            const count = aircraft.filter(a => a.aircraftType.id === category.id).length;
            if (count > 0) {
                stats.byCategory[category.name] = count;
            }
        });

        return stats;
    }

    /**
     * Get altitude statistics
     */
    static getAltitudeStatistics(aircraft) {
        const inFlightAircraft = aircraft.filter(a => !a.onGround && a.altitudeFeet !== null);

        if (inFlightAircraft.length === 0) {
            return { min: 0, max: 0, average: 0, count: 0 };
        }

        const altitudes = inFlightAircraft.map(a => a.altitudeFeet);

        return {
            min: Math.min(...altitudes),
            max: Math.max(...altitudes),
            average: Math.round(altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length),
            count: altitudes.length
        };
    }

    /**
     * Get speed statistics
     */
    static getSpeedStatistics(aircraft) {
        const movingAircraft = aircraft.filter(a => !a.onGround && a.speedKnots !== null);

        if (movingAircraft.length === 0) {
            return { min: 0, max: 0, average: 0, count: 0 };
        }

        const speeds = movingAircraft.map(a => a.speedKnots);

        return {
            min: Math.min(...speeds),
            max: Math.max(...speeds),
            average: Math.round(speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length),
            count: speeds.length
        };
    }

    /**
     * Create ProcessedAircraft from AircraftState
     * @param {AircraftState} aircraftState - Raw aircraft state
     * @returns {ProcessedAircraft} Processed aircraft with classification
     */
    static processAircraft(aircraftState) {
        const category = this.classifyAircraft(aircraftState);
        return new ProcessedAircraft(aircraftState, category);
    }

    /**
     * Update processed aircraft with new state
     * @param {ProcessedAircraft} aircraft - Existing processed aircraft
     * @param {AircraftState} newState - New aircraft state
     * @returns {ProcessedAircraft} Updated aircraft
     */
    static updateAircraft(aircraft, newState) {
        aircraft.updateState(newState);

        // Re-classify if needed (aircraft type might change)
        const newCategory = this.classifyAircraft(newState);
        if (newCategory.id !== aircraft.aircraftType.id) {
            aircraft.aircraftType = newCategory;
            aircraft.displayColor = newCategory.color;
            aircraft.displayIcon = newCategory.icon;
            aircraft.displaySize = newCategory.size;
        }

        return aircraft;
    }
}