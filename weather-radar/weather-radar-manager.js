import { ARSODataService } from './arso-data-service.js';
import { RadarPolygonRenderer } from './radar-polygon-renderer.js';
import { WeatherCache } from './weather-cache.js';

export class WeatherRadarManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.dataService = new ARSODataService();
        this.renderer = new RadarPolygonRenderer(viewer);
        this.cache = new WeatherCache();

        this.isActive = false;
        this.autoUpdate = false;
        this.updateInterval = 10 * 60 * 1000; // 10 minutes
        this.updateTimer = null;

        // Animation properties
        this.isAnimating = false;
        this.animationFrames = [];
        this.currentFrame = 0;
        this.animationTimer = null;
        this.animationSpeed = 1000; // ms between frames

        // Event callbacks
        this.onDataUpdate = null;
        this.onError = null;
        this.onAnimationFrame = null;

        this.initialize();
    }

    async initialize() {
        try {
            console.log('Initializing Weather Radar Manager...');

            // Load cached data
            this.cache.loadFromStorage();

            // Try to display recent cached data if available
            if (this.cache.hasRecentData()) {
                const latestData = this.cache.getLatestRadarData();
                if (latestData) {
                    this.renderer.renderRadarData(latestData);
                    console.log('Displayed cached radar data');
                }
            }

            console.log('Weather Radar Manager initialized');
        } catch (error) {
            console.error('Error initializing weather radar manager:', error);
            if (this.onError) this.onError(error);
        }
    }

    async activate() {
        if (this.isActive) return;

        try {
            console.log('Activating weather radar...');
            this.isActive = true;

            // Fetch and display current data
            await this.updateRadarData();

            // Start auto-update if enabled
            if (this.autoUpdate) {
                this.startAutoUpdate();
            }

            this.renderer.setVisibility(true);
            console.log('Weather radar activated');
        } catch (error) {
            console.error('Error activating weather radar:', error);
            this.isActive = false;
            if (this.onError) this.onError(error);
        }
    }

    deactivate() {
        console.log('Deactivating weather radar...');
        this.isActive = false;

        this.stopAutoUpdate();
        this.stopAnimation();
        this.renderer.setVisibility(false);

        console.log('Weather radar deactivated');
    }

    async updateRadarData() {
        try {
            console.log('Fetching new radar data...');

            // For MVP, use test data for a single point first
            // Later can be expanded to full grid
            const data = await this.dataService.getTestData();

            if (data) {
                // Cache the data
                this.cache.storeRadarData(data);

                // Render the data
                this.renderer.renderRadarData(data);

                console.log('Radar data updated successfully');

                if (this.onDataUpdate) {
                    this.onDataUpdate(data);
                }

                return data;
            } else {
                console.warn('No radar data received');
                return null;
            }
        } catch (error) {
            console.error('Error updating radar data:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    async fetchFullGridData() {
        try {
            console.log('Fetching full grid radar data...');
            const data = await this.dataService.getCurrentRadarData();

            if (data) {
                this.cache.storeRadarData(data);
                this.renderer.renderRadarData(data);

                if (this.onDataUpdate) {
                    this.onDataUpdate(data);
                }

                return data;
            }
            return null;
        } catch (error) {
            console.error('Error fetching full grid data:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    startAutoUpdate() {
        if (this.updateTimer) return;

        console.log(`Starting auto-update every ${this.updateInterval / 1000 / 60} minutes`);

        this.updateTimer = setInterval(async () => {
            if (this.isActive && !this.isAnimating) {
                await this.updateRadarData();
            }
        }, this.updateInterval);
    }

    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            console.log('Auto-update stopped');
        }
    }

    setAutoUpdate(enabled) {
        this.autoUpdate = enabled;

        if (enabled && this.isActive) {
            this.startAutoUpdate();
        } else {
            this.stopAutoUpdate();
        }
    }

    // Animation methods
    async startAnimation(durationMinutes = 60) {
        if (this.isAnimating) return;

        console.log(`Starting radar animation for last ${durationMinutes} minutes`);

        try {
            this.animationFrames = this.cache.createAnimationSequence(durationMinutes);

            if (this.animationFrames.length === 0) {
                console.warn('No cached data available for animation');
                return;
            }

            this.isAnimating = true;
            this.currentFrame = 0;

            this.playAnimation();
        } catch (error) {
            console.error('Error starting animation:', error);
            if (this.onError) this.onError(error);
        }
    }

    playAnimation() {
        if (!this.isAnimating || this.currentFrame >= this.animationFrames.length) {
            this.stopAnimation();
            return;
        }

        const frame = this.animationFrames[this.currentFrame];
        this.renderer.renderRadarData(frame.data);

        if (this.onAnimationFrame) {
            this.onAnimationFrame(frame);
        }

        this.currentFrame++;

        this.animationTimer = setTimeout(() => {
            this.playAnimation();
        }, this.animationSpeed);
    }

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        this.isAnimating = false;
        this.currentFrame = 0;
        this.animationFrames = [];

        // Return to latest data
        if (this.isActive) {
            const latestData = this.cache.getLatestRadarData();
            if (latestData) {
                this.renderer.renderRadarData(latestData);
            }
        }

        console.log('Animation stopped');
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(100, Math.min(5000, speed));
    }

    // Control methods
    setVisibility(visible) {
        this.renderer.setVisibility(visible);
    }

    getVisibility() {
        return this.renderer.getVisibility();
    }

    setOpacity(opacity) {
        this.renderer.updateOpacity(opacity);
    }

    // Information methods
    getStatus() {
        return {
            isActive: this.isActive,
            autoUpdate: this.autoUpdate,
            isAnimating: this.isAnimating,
            hasData: this.cache.getAvailableTimestamps().length > 0,
            lastUpdate: this.cache.getCacheStats().newestEntry,
            cacheStats: this.cache.getCacheStats(),
            renderStats: this.renderer.getStats()
        };
    }

    getAvailableTimestamps() {
        return this.cache.getAvailableTimestamps();
    }

    async loadHistoricalData(timestamp) {
        const data = this.cache.getRadarData(timestamp);
        if (data) {
            this.renderer.renderRadarData(data);
            return data;
        }
        return null;
    }

    clearCache() {
        this.cache.clearCache();
        this.renderer.clearRadarData();
    }

    // Event handler setters
    onDataUpdateCallback(callback) {
        this.onDataUpdate = callback;
    }

    onErrorCallback(callback) {
        this.onError = callback;
    }

    onAnimationFrameCallback(callback) {
        this.onAnimationFrame = callback;
    }

    // Cleanup
    destroy() {
        this.deactivate();
        this.renderer.clearRadarData();
        this.cache.clearCache();
    }

    // Testing method
    async testConnection() {
        try {
            console.log('Testing ARSO connection...');
            const testData = await this.dataService.getTestData();
            return {
                success: !!testData,
                data: testData,
                message: testData ? 'Connection successful' : 'No data received'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Connection failed'
            };
        }
    }
}