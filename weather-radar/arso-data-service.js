import { DummyWeatherGenerator } from './dummy-weather-generator.js';

export class ARSODataService {
    constructor() {
        this.baseUrl = 'https://api.kiberpipe.org/vreme/report/';
        this.updateInterval = 10 * 60 * 1000; // 10 minutes in milliseconds
        this.sloveniaGrid = this.generateSloveniaGrid();
        this.demoMode = true; // Start in demo mode
        this.dummyGenerator = new DummyWeatherGenerator();
    }

    generateSloveniaGrid() {
        const grid = [];
        const latMin = 45.21;
        const latMax = 47.05;
        const lonMin = 12.92;
        const lonMax = 16.71;
        const resolution = 0.05; // ~5km resolution

        for (let lat = latMin; lat <= latMax; lat += resolution) {
            for (let lon = lonMin; lon <= lonMax; lon += resolution) {
                grid.push({
                    lat: Math.round(lat * 100) / 100,
                    lon: Math.round(lon * 100) / 100
                });
            }
        }
        return grid;
    }

    async fetchWeatherData(lat, lon) {
        try {
            const url = `${this.baseUrl}?lat=${lat}&lon=${lon}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.processWeatherData(data, lat, lon);
        } catch (error) {
            console.warn(`Failed to fetch weather data for ${lat}, ${lon}:`, error);
            return null;
        }
    }

    processWeatherData(data, lat, lon) {
        if (!data || !data.observation) {
            return null;
        }

        const observation = data.observation;

        // Extract precipitation intensity (0-100)
        let precipitationIntensity = 0;

        if (observation.precipitation_mm_h !== undefined) {
            // Convert mm/h to intensity scale (0-100)
            const mmPerHour = parseFloat(observation.precipitation_mm_h) || 0;
            precipitationIntensity = Math.min(100, Math.max(0, mmPerHour * 10));
        } else if (observation.radar_precipitation !== undefined) {
            precipitationIntensity = parseFloat(observation.radar_precipitation) || 0;
        }

        return {
            lat,
            lon,
            intensity: precipitationIntensity,
            timestamp: new Date().toISOString(),
            rawData: observation
        };
    }

    async fetchRadarDataGrid() {
        console.log('Fetching radar data for Slovenia grid...');

        const promises = this.sloveniaGrid.map(point =>
            this.fetchWeatherData(point.lat, point.lon)
        );

        // Fetch in batches to avoid overwhelming the API
        const batchSize = 10;
        const results = [];

        for (let i = 0; i < promises.length; i += batchSize) {
            const batch = promises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);

            // Add small delay between batches
            if (i + batchSize < promises.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results.filter(result => result !== null);
    }

    convertToGeoJSON(radarData) {
        const features = radarData
            .filter(point => point.intensity > 0)
            .map(point => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [point.lon, point.lat]
                },
                properties: {
                    intensity: point.intensity,
                    timestamp: point.timestamp,
                    color: this.getColorForIntensity(point.intensity),
                    altitude: this.getAltitudeForIntensity(point.intensity)
                }
            }));

        return {
            type: 'FeatureCollection',
            features,
            metadata: {
                timestamp: new Date().toISOString(),
                source: 'ARSO via Kiberpipe API',
                coverage: 'Slovenia',
                resolution: '~5km'
            }
        };
    }

    getColorForIntensity(intensity) {
        if (intensity <= 0) return '#FFFFFF';    // White - no precipitation
        if (intensity <= 25) return '#00FF00';   // Green - light
        if (intensity <= 50) return '#FFFF00';   // Yellow - moderate
        if (intensity <= 75) return '#FFA500';   // Orange - heavy
        return '#FF0000';                        // Red - extreme
    }

    getAltitudeForIntensity(intensity) {
        if (intensity <= 0) return 0;
        if (intensity <= 25) return 1500;  // 1.5km
        if (intensity <= 50) return 3000;  // 3km
        if (intensity <= 75) return 4500;  // 4.5km
        return 6000;                       // 6km
    }

    setDemoMode(enabled) {
        this.demoMode = enabled;
        console.log(`Weather data demo mode: ${enabled ? 'ON' : 'OFF'}`);
    }

    async getCurrentRadarData() {
        try {
            if (this.demoMode) {
                console.log('Generating dummy weather data...');
                return this.dummyGenerator.generateCurrentData();
            } else {
                const rawData = await this.fetchRadarDataGrid();
                return this.convertToGeoJSON(rawData);
            }
        } catch (error) {
            console.error('Error fetching radar data:', error);
            throw error;
        }
    }

    // Method for testing with a single point
    async getTestData(lat = 46.0569, lon = 14.5058) { // Ljubljana coordinates
        try {
            if (this.demoMode) {
                console.log('Generating demo test data...');
                // Generate a small area around the test point
                return this.dummyGenerator.generateCurrentData();
            } else {
                const data = await this.fetchWeatherData(lat, lon);
                if (data) {
                    return this.convertToGeoJSON([data]);
                }
                return null;
            }
        } catch (error) {
            console.error('Error fetching test data:', error);
            throw error;
        }
    }

    // Method to advance time in demo mode (for animation)
    advanceDemoTime(minutes = 10) {
        if (this.demoMode) {
            return this.dummyGenerator.advanceTime(minutes);
        }
        return null;
    }

    // Method to get demo historical data
    getDemoHistoricalSequence(durationMinutes = 120, intervalMinutes = 10) {
        if (this.demoMode) {
            return this.dummyGenerator.generateHistoricalSequence(durationMinutes, intervalMinutes);
        }
        return [];
    }

    // Get demo system info
    getDemoSystemInfo() {
        if (this.demoMode) {
            return this.dummyGenerator.getSystemInfo();
        }
        return null;
    }
}