// aircraft-tracker.js
// Aircraft tracking manager with position interpolation and data management

import { AircraftAPIService } from './aircraft-api-service.js';
import { AircraftClassifier } from './aircraft-classifier.js';
import { AircraftVisualizer } from './aircraft-visualizer.js';
import { ProcessedAircraft, AircraftConfig } from './aircraft-types.js';

/**
 * Main aircraft tracking system that manages data fetching, processing,
 * and visualization updates with smooth position interpolation
 */
export class AircraftTracker {
    constructor(viewer) {
        this.viewer = viewer;

        // Core services
        this.apiService = new AircraftAPIService();
        this.visualizer = new AircraftVisualizer(viewer);

        // Aircraft data management
        this.aircraft = new Map(); // icao24 -> ProcessedAircraft
        this.lastUpdateTime = 0;
        this.updateInterval = AircraftConfig.updateInterval;

        // Update loop management
        this.updateTimer = null;
        this.isRunning = false;
        this.isPaused = false;

        // Position interpolation
        this.interpolationEnabled = true;
        this.interpolationSteps = 30; // Steps per update interval

        // Performance tracking
        this.updateCount = 0;
        this.lastFetchTime = 0;
        this.averageUpdateTime = 0;

        // Event handlers
        this.eventHandlers = {
            onAircraftUpdate: null,
            onError: null,
            onStatusChange: null
        };

        // Configuration
        this.config = {
            region: 'slovenia', // 'slovenia', 'custom', 'global'
            customBounds: null,
            maxAircraft: AircraftConfig.maxAircraft,
            cleanupInterval: 300000, // 5 minutes
            retryInterval: 60000     // 1 minute retry on error
        };

        this.setupEventHandlers();
        console.log('Aircraft Tracker initialized');
    }

    /**
     * Setup event handlers for visualization interactions
     */
    setupEventHandlers() {
        this.visualizer.onAircraftClick((aircraft, position) => {
            this.selectAircraft(aircraft.icao24);
            if (this.eventHandlers.onAircraftUpdate) {
                this.eventHandlers.onAircraftUpdate({
                    type: 'aircraft_selected',
                    aircraft: aircraft
                });
            }
        });

        this.visualizer.onAircraftHover((aircraft, position) => {
            if (aircraft) {
                this.visualizer.highlightAircraft(aircraft.icao24, true);
            }
        });
    }

    /**
     * Start aircraft tracking
     * @param {Object} options - Tracking options
     */
    async start(options = {}) {
        if (this.isRunning) {
            console.warn('Aircraft tracking already running');
            return;
        }

        // Update configuration
        Object.assign(this.config, options);

        console.log('Starting aircraft tracking...');

        try {
            // Start update loop immediately
            this.isRunning = true;
            this.isPaused = false;

            // Check if we can make an immediate request
            const canMakeRequest = this.apiService.canMakeRequest();

            if (canMakeRequest) {
                // Try initial data fetch
                try {
                    await this.updateAircraftData();
                    console.log('Aircraft tracking started with initial data');
                } catch (error) {
                    if (error.message.includes('Rate limited')) {
                        console.log('Rate limited on start, scheduling next update...');
                        this.scheduleNextUpdate();
                    } else {
                        throw error; // Re-throw non-rate-limit errors
                    }
                }
            } else {
                // Schedule the first update for when we can make a request
                console.log('Rate limited, scheduling first update...');
                this.scheduleNextUpdate();
            }

            if (this.eventHandlers.onStatusChange) {
                this.eventHandlers.onStatusChange({
                    status: 'running',
                    message: 'Aircraft tracking started successfully'
                });
            }

        } catch (error) {
            console.error('Failed to start aircraft tracking:', error);
            this.isRunning = false;

            if (this.eventHandlers.onError) {
                this.eventHandlers.onError(error);
            }

            throw error;
        }
    }

    /**
     * Stop aircraft tracking
     */
    stop() {
        if (!this.isRunning) {
            console.warn('Aircraft tracking not running');
            return;
        }

        console.log('Stopping aircraft tracking...');

        this.isRunning = false;
        this.isPaused = false;

        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        // Clear visualization
        this.visualizer.clearAircraft();
        this.aircraft.clear();

        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange({
                status: 'stopped',
                message: 'Aircraft tracking stopped'
            });
        }

        console.log('Aircraft tracking stopped');
    }

    /**
     * Pause aircraft tracking (keeps data, stops updates)
     */
    pause() {
        if (!this.isRunning || this.isPaused) return;

        this.isPaused = true;

        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange({
                status: 'paused',
                message: 'Aircraft tracking paused'
            });
        }

        console.log('Aircraft tracking paused');
    }

    /**
     * Resume aircraft tracking
     */
    resume() {
        if (!this.isRunning || !this.isPaused) return;

        this.isPaused = false;
        this.scheduleNextUpdate();

        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange({
                status: 'running',
                message: 'Aircraft tracking resumed'
            });
        }

        console.log('Aircraft tracking resumed');
    }

    /**
     * Schedule next update based on configuration and API limits
     */
    scheduleNextUpdate() {
        if (!this.isRunning || this.isPaused) return;

        // Check API rate limits
        const timeUntilNextRequest = this.apiService.getTimeUntilNextRequest();
        const delay = Math.max(this.updateInterval, timeUntilNextRequest);

        this.updateTimer = setTimeout(() => {
            this.updateAircraftData().catch(error => {
                console.error('Aircraft update failed:', error);

                if (this.eventHandlers.onError) {
                    this.eventHandlers.onError(error);
                }

                // Retry with longer delay on error
                setTimeout(() => this.scheduleNextUpdate(), this.config.retryInterval);
            });
        }, delay);
    }

    /**
     * Fetch and update aircraft data from API
     */
    async updateAircraftData() {
        if (!this.isRunning || this.isPaused) return;

        const startTime = performance.now();

        try {
            console.log('Fetching aircraft data...');

            // Fetch data based on region configuration
            let rawAircraft;
            switch (this.config.region) {
                case 'slovenia':
                    rawAircraft = await this.apiService.fetchAircraftInSlovenia();
                    break;
                case 'custom':
                    if (this.config.customBounds) {
                        rawAircraft = await this.apiService.fetchAircraftData({
                            bbox: this.config.customBounds
                        });
                    } else {
                        throw new Error('Custom bounds not configured');
                    }
                    break;
                case 'global':
                    rawAircraft = await this.apiService.fetchAircraftData();
                    break;
                default:
                    rawAircraft = await this.apiService.fetchAircraftInSlovenia();
            }

            // Process and classify aircraft
            const processedAircraft = this.processAircraftData(rawAircraft);

            // Update visualization
            await this.visualizer.updateAircraft(processedAircraft);

            // Update statistics
            this.updateCount++;
            this.lastFetchTime = performance.now() - startTime;
            this.updateAverageTime();

            if (this.eventHandlers.onAircraftUpdate) {
                this.eventHandlers.onAircraftUpdate({
                    type: 'data_updated',
                    aircraft: processedAircraft,
                    stats: this.getStatistics()
                });
            }

            console.log(`Aircraft data updated: ${processedAircraft.length} aircraft (${this.lastFetchTime.toFixed(1)}ms)`);

        } catch (error) {
            console.error('Aircraft data update failed:', error);
            throw error;
        } finally {
            // Schedule next update
            this.scheduleNextUpdate();
        }
    }

    /**
     * Process raw aircraft data and manage lifecycle
     * @param {AircraftState[]} rawAircraft - Raw aircraft from API
     * @returns {ProcessedAircraft[]} Processed aircraft array
     */
    processAircraftData(rawAircraft) {
        const processed = [];
        const currentTime = Date.now();
        const activeIds = new Set();

        // Process each aircraft
        for (const rawState of rawAircraft) {
            try {
                const icao24 = rawState.icao24;
                activeIds.add(icao24);

                const existing = this.aircraft.get(icao24);

                if (existing) {
                    // Update existing aircraft
                    AircraftClassifier.updateAircraft(existing, rawState);

                    // Position interpolation if enabled
                    if (this.interpolationEnabled) {
                        this.updateInterpolation(existing);
                    }

                    processed.push(existing);

                } else {
                    // Create new aircraft
                    const newAircraft = AircraftClassifier.processAircraft(rawState);
                    this.aircraft.set(icao24, newAircraft);
                    processed.push(newAircraft);

                    console.log(`New aircraft: ${newAircraft.callsign || icao24} (${newAircraft.aircraftType.name})`);
                }

            } catch (error) {
                console.warn('Failed to process aircraft:', error);
                continue;
            }
        }

        // Clean up aircraft no longer present
        this.cleanupInactiveAircraft(activeIds, currentTime);

        // Limit total aircraft count
        if (processed.length > this.config.maxAircraft) {
            processed.sort((a, b) => b.lastContact - a.lastContact);
            processed.splice(this.config.maxAircraft);
        }

        return processed;
    }

    /**
     * Update position interpolation for smooth movement
     * @param {ProcessedAircraft} aircraft - Aircraft to interpolate
     */
    updateInterpolation(aircraft) {
        if (aircraft.trail.length < 2) return;

        const currentPos = aircraft.trail[aircraft.trail.length - 1];
        const previousPos = aircraft.trail[aircraft.trail.length - 2];

        // Calculate time difference
        const timeDiff = currentPos.timestamp - previousPos.timestamp;
        if (timeDiff <= 0) return;

        // Calculate velocity vector
        const deltaLat = currentPos.latitude - previousPos.latitude;
        const deltaLon = currentPos.longitude - previousPos.longitude;
        const deltaAlt = (currentPos.altitude || 0) - (previousPos.altitude || 0);

        // Store interpolation data
        aircraft.interpolation = {
            startPos: { ...previousPos },
            endPos: { ...currentPos },
            startTime: previousPos.timestamp,
            endTime: currentPos.timestamp,
            deltaLat: deltaLat,
            deltaLon: deltaLon,
            deltaAlt: deltaAlt
        };
    }

    /**
     * Get interpolated position for aircraft at current time
     * @param {ProcessedAircraft} aircraft - Aircraft to interpolate
     * @returns {Object|null} Interpolated position or null
     */
    getInterpolatedPosition(aircraft) {
        if (!aircraft.interpolation || !this.interpolationEnabled) {
            return null;
        }

        const now = Date.now();
        const { startTime, endTime, startPos, deltaLat, deltaLon, deltaAlt } = aircraft.interpolation;

        // Check if interpolation is still valid
        if (now < startTime || now > endTime + 30000) { // 30 second tolerance
            return null;
        }

        // Calculate interpolation factor (0 to 1)
        const factor = Math.min(1, (now - startTime) / (endTime - startTime));

        return {
            longitude: startPos.longitude + (deltaLon * factor),
            latitude: startPos.latitude + (deltaLat * factor),
            altitude: (startPos.altitude || 0) + (deltaAlt * factor),
            timestamp: now,
            interpolated: true
        };
    }

    /**
     * Clean up aircraft that are no longer active
     * @param {Set} activeIds - Set of currently active aircraft IDs
     * @param {number} currentTime - Current timestamp
     */
    cleanupInactiveAircraft(activeIds, currentTime) {
        const toRemove = [];

        for (const [icao24, aircraft] of this.aircraft) {
            if (!activeIds.has(icao24)) {
                // Check if aircraft should be removed
                const timeSinceContact = currentTime - aircraft.lastSeen.getTime();

                if (timeSinceContact > this.config.cleanupInterval) {
                    toRemove.push(icao24);
                }
            }
        }

        // Remove inactive aircraft
        for (const icao24 of toRemove) {
            this.aircraft.delete(icao24);
            console.log(`Removed inactive aircraft: ${icao24}`);
        }
    }

    /**
     * Update running average of update times
     */
    updateAverageTime() {
        const alpha = 0.1; // Exponential moving average factor
        if (this.averageUpdateTime === 0) {
            this.averageUpdateTime = this.lastFetchTime;
        } else {
            this.averageUpdateTime = (alpha * this.lastFetchTime) + ((1 - alpha) * this.averageUpdateTime);
        }
    }

    /**
     * Select aircraft and focus on it
     * @param {string} icao24 - Aircraft identifier
     */
    selectAircraft(icao24) {
        this.visualizer.selectAircraft(icao24, true);
        this.visualizer.focusOnAircraft(icao24);
    }

    /**
     * Set visualization filters
     * @param {Object} filters - Filter configuration
     */
    setFilters(filters) {
        this.visualizer.setFilters(filters);
    }

    /**
     * Set region for aircraft tracking
     * @param {string} region - Region name ('slovenia', 'custom', 'global')
     * @param {Array} bounds - Custom bounds for 'custom' region [lamin, lomin, lamax, lomax]
     */
    setRegion(region, bounds = null) {
        this.config.region = region;
        this.config.customBounds = bounds;

        console.log(`Aircraft tracking region set to: ${region}`);
    }

    /**
     * Get comprehensive statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const visualizerStats = this.visualizer.getStatistics();
        const apiStats = this.apiService.getUsageStats();

        return {
            ...visualizerStats,
            api: apiStats,
            tracking: {
                isRunning: this.isRunning,
                isPaused: this.isPaused,
                updateCount: this.updateCount,
                lastFetchTime: this.lastFetchTime,
                averageUpdateTime: this.averageUpdateTime,
                updateInterval: this.updateInterval,
                interpolationEnabled: this.interpolationEnabled
            },
            region: this.config.region
        };
    }

    /**
     * Event handler registration
     */
    onAircraftUpdate(callback) {
        this.eventHandlers.onAircraftUpdate = callback;
    }

    onError(callback) {
        this.eventHandlers.onError = callback;
    }

    onStatusChange(callback) {
        this.eventHandlers.onStatusChange = callback;
    }

    /**
     * Get aircraft by ID
     * @param {string} icao24 - Aircraft identifier
     * @returns {ProcessedAircraft|null} Aircraft data
     */
    getAircraft(icao24) {
        return this.aircraft.get(icao24) || null;
    }

    /**
     * Get all aircraft
     * @returns {ProcessedAircraft[]} Array of all aircraft
     */
    getAllAircraft() {
        return Array.from(this.aircraft.values());
    }

    /**
     * Search aircraft by callsign or ICAO24
     * @param {string} searchTerm - Search term
     * @returns {ProcessedAircraft[]} Matching aircraft
     */
    searchAircraft(searchTerm) {
        const term = searchTerm.toLowerCase();
        return this.getAllAircraft().filter(aircraft => {
            const callsign = (aircraft.callsign || '').toLowerCase();
            const icao24 = aircraft.icao24.toLowerCase();
            return callsign.includes(term) || icao24.includes(term);
        });
    }

    /**
     * Handle click events from viewer
     * @param {Cartesian2} position - Screen position
     * @returns {ProcessedAircraft|null} Clicked aircraft
     */
    handleClick(position) {
        return this.visualizer.handleClick(position);
    }

    /**
     * Handle hover events from viewer
     * @param {Cartesian2} position - Screen position
     * @returns {ProcessedAircraft|null} Hovered aircraft
     */
    handleHover(position) {
        return this.visualizer.handleHover(position);
    }

    /**
     * Destroy tracker and cleanup resources
     */
    destroy() {
        this.stop();
        this.visualizer.destroy();
        this.apiService.destroy();
        this.eventHandlers = {};

        console.log('Aircraft Tracker destroyed');
    }
}