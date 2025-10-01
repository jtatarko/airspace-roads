export class WeatherCache {
    constructor() {
        this.cacheKey = 'weatherRadarCache';
        this.maxCacheAge = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        this.maxCacheEntries = 36; // Store up to 6 hours of 10-minute intervals
        this.memoryCache = new Map();
    }

    // Store radar data with timestamp
    storeRadarData(data, timestamp = new Date()) {
        const entry = {
            timestamp: timestamp.toISOString(),
            data: data,
            id: this.generateId(timestamp)
        };

        // Store in memory cache
        this.memoryCache.set(entry.id, entry);

        // Store in localStorage
        this.updateLocalStorage(entry);

        console.log(`Cached radar data for ${timestamp.toISOString()}`);
        return entry.id;
    }

    generateId(timestamp) {
        return `radar_${timestamp.getTime()}`;
    }

    updateLocalStorage(newEntry) {
        try {
            let cachedData = this.getStoredData();

            // Add new entry
            cachedData.push(newEntry);

            // Sort by timestamp
            cachedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Remove old entries
            cachedData = this.cleanupOldEntries(cachedData);

            // Limit number of entries
            if (cachedData.length > this.maxCacheEntries) {
                cachedData = cachedData.slice(-this.maxCacheEntries);
            }

            localStorage.setItem(this.cacheKey, JSON.stringify(cachedData));
        } catch (error) {
            console.warn('Failed to update localStorage cache:', error);
        }
    }

    getStoredData() {
        try {
            const stored = localStorage.getItem(this.cacheKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Failed to parse stored cache data:', error);
            return [];
        }
    }

    cleanupOldEntries(cachedData) {
        const cutoffTime = new Date(Date.now() - this.maxCacheAge);
        return cachedData.filter(entry => new Date(entry.timestamp) > cutoffTime);
    }

    // Get radar data for a specific timestamp
    getRadarData(timestamp) {
        const id = this.generateId(timestamp);

        // Check memory cache first
        if (this.memoryCache.has(id)) {
            return this.memoryCache.get(id).data;
        }

        // Check localStorage
        const cachedData = this.getStoredData();
        const entry = cachedData.find(item => item.id === id);

        if (entry) {
            // Add back to memory cache
            this.memoryCache.set(id, entry);
            return entry.data;
        }

        return null;
    }

    // Get the most recent radar data
    getLatestRadarData() {
        // Check memory cache first
        let latest = null;
        let latestTime = 0;

        this.memoryCache.forEach(entry => {
            const time = new Date(entry.timestamp).getTime();
            if (time > latestTime) {
                latestTime = time;
                latest = entry.data;
            }
        });

        if (latest) return latest;

        // Check localStorage
        const cachedData = this.getStoredData();
        if (cachedData.length > 0) {
            const latestEntry = cachedData[cachedData.length - 1];
            this.memoryCache.set(latestEntry.id, latestEntry);
            return latestEntry.data;
        }

        return null;
    }

    // Get all available timestamps
    getAvailableTimestamps() {
        const timestamps = [];

        // From memory cache
        this.memoryCache.forEach(entry => {
            timestamps.push(new Date(entry.timestamp));
        });

        // From localStorage
        const cachedData = this.getStoredData();
        cachedData.forEach(entry => {
            const timestamp = new Date(entry.timestamp);
            if (!timestamps.some(t => t.getTime() === timestamp.getTime())) {
                timestamps.push(timestamp);
            }
        });

        return timestamps.sort((a, b) => a - b);
    }

    // Get radar data for time range
    getRadarDataRange(startTime, endTime) {
        const results = [];
        const cachedData = this.getStoredData();

        cachedData.forEach(entry => {
            const entryTime = new Date(entry.timestamp);
            if (entryTime >= startTime && entryTime <= endTime) {
                results.push({
                    timestamp: entryTime,
                    data: entry.data
                });
            }
        });

        // Also check memory cache
        this.memoryCache.forEach(entry => {
            const entryTime = new Date(entry.timestamp);
            if (entryTime >= startTime && entryTime <= endTime) {
                // Avoid duplicates
                if (!results.some(r => r.timestamp.getTime() === entryTime.getTime())) {
                    results.push({
                        timestamp: entryTime,
                        data: entry.data
                    });
                }
            }
        });

        return results.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Check if we have recent data (within last 15 minutes)
    hasRecentData() {
        const recentCutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
        const timestamps = this.getAvailableTimestamps();
        return timestamps.some(timestamp => timestamp > recentCutoff);
    }

    // Get cache statistics
    getCacheStats() {
        const timestamps = this.getAvailableTimestamps();
        const memoryEntries = this.memoryCache.size;
        const storageEntries = this.getStoredData().length;

        return {
            totalEntries: timestamps.length,
            memoryEntries,
            storageEntries,
            oldestEntry: timestamps.length > 0 ? timestamps[0] : null,
            newestEntry: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
            storageSize: this.getStorageSize()
        };
    }

    getStorageSize() {
        try {
            const data = localStorage.getItem(this.cacheKey);
            return data ? new Blob([data]).size : 0;
        } catch (error) {
            return 0;
        }
    }

    // Clear all cached data
    clearCache() {
        this.memoryCache.clear();
        try {
            localStorage.removeItem(this.cacheKey);
            console.log('Weather cache cleared');
        } catch (error) {
            console.warn('Failed to clear localStorage cache:', error);
        }
    }

    // Initialize cache from localStorage
    loadFromStorage() {
        const cachedData = this.getStoredData();
        const cleanedData = this.cleanupOldEntries(cachedData);

        // Update localStorage with cleaned data
        if (cleanedData.length !== cachedData.length) {
            try {
                localStorage.setItem(this.cacheKey, JSON.stringify(cleanedData));
            } catch (error) {
                console.warn('Failed to update localStorage after cleanup:', error);
            }
        }

        // Load recent entries into memory cache
        const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour
        cleanedData.forEach(entry => {
            if (new Date(entry.timestamp) > recentCutoff) {
                this.memoryCache.set(entry.id, entry);
            }
        });

        console.log(`Loaded ${this.memoryCache.size} entries into memory cache`);
    }

    // Create animation sequence from cached data
    createAnimationSequence(durationMinutes = 60) {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

        const dataRange = this.getRadarDataRange(startTime, endTime);

        return dataRange.map((entry, index) => ({
            timestamp: entry.timestamp,
            data: entry.data,
            sequenceIndex: index,
            totalFrames: dataRange.length
        }));
    }
}