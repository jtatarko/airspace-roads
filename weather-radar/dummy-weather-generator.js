export class DummyWeatherGenerator {
    constructor() {
        this.sloveniaGrid = this.generateSloveniaGrid();
        this.weatherSystems = [];
        this.timeOffset = 0; // For animation

        // Slovenia geographic features for realistic patterns
        this.mountainRanges = [
            { lat: 46.5, lon: 14.1, radius: 0.3, name: 'Kamnik Alps' },
            { lat: 46.3, lon: 13.8, radius: 0.4, name: 'Julian Alps' },
            { lat: 46.1, lon: 14.8, radius: 0.2, name: 'Karawanks' },
            { lat: 45.8, lon: 14.5, radius: 0.3, name: 'Slovenian Hills' },
            { lat: 45.5, lon: 15.2, radius: 0.2, name: 'Dinaric Alps' }
        ];

        this.cities = [
            { lat: 46.0569, lon: 14.5058, name: 'Ljubljana' },
            { lat: 46.2444, lon: 15.2263, name: 'Maribor' },
            { lat: 45.5444, lon: 13.7306, name: 'Koper' },
            { lat: 46.3683, lon: 15.1178, name: 'Celje' },
            { lat: 45.8014, lon: 15.1678, name: 'Novo Mesto' }
        ];

        this.initializeWeatherSystems();
    }

    generateSloveniaGrid() {
        const grid = [];
        const latMin = 45.21;
        const latMax = 47.05;
        const lonMin = 12.92;
        const lonMax = 16.71;
        const resolution = 0.04; // ~4km resolution for better detail

        for (let lat = latMin; lat <= latMax; lat += resolution) {
            for (let lon = lonMin; lon <= lonMax; lon += resolution) {
                grid.push({
                    lat: Math.round(lat * 1000) / 1000,
                    lon: Math.round(lon * 1000) / 1000
                });
            }
        }
        return grid;
    }

    initializeWeatherSystems() {
        // Create different types of weather patterns
        this.weatherSystems = [
            this.createThunderstormCluster(),
            this.createRainBand(),
            this.createLocalizedShower(),
            this.createMountainPrecipitation()
        ];

        console.log('Initialized weather systems:', this.weatherSystems.length);
        this.weatherSystems.forEach((system, index) => {
            console.log(`System ${index}:`, system.type, system.center || system.start);
        });
    }

    createThunderstormCluster() {
        return {
            type: 'thunderstorm',
            center: { lat: 46.1 + Math.random() * 0.8, lon: 13.5 + Math.random() * 2.0 },
            radius: 0.15 + Math.random() * 0.1,
            intensity: 70 + Math.random() * 30,
            movement: { latSpeed: -0.002, lonSpeed: 0.003 },
            lifetime: 120, // minutes
            age: Math.random() * 60
        };
    }

    createRainBand() {
        return {
            type: 'rainband',
            start: { lat: 45.3, lon: 12.8 + Math.random() * 0.5 },
            end: { lat: 46.8, lon: 14.5 + Math.random() * 0.5 },
            width: 0.08 + Math.random() * 0.04,
            intensity: 30 + Math.random() * 40,
            movement: { latSpeed: 0, lonSpeed: 0.004 },
            lifetime: 180,
            age: Math.random() * 90
        };
    }

    createLocalizedShower() {
        return {
            type: 'shower',
            center: { lat: 45.5 + Math.random() * 1.0, lon: 13.2 + Math.random() * 2.5 },
            radius: 0.06 + Math.random() * 0.04,
            intensity: 20 + Math.random() * 30,
            movement: { latSpeed: -0.001, lonSpeed: 0.002 },
            lifetime: 45,
            age: Math.random() * 20
        };
    }

    createMountainPrecipitation() {
        const mountain = this.mountainRanges[Math.floor(Math.random() * this.mountainRanges.length)];
        return {
            type: 'mountain',
            center: {
                lat: mountain.lat + (Math.random() - 0.5) * 0.1,
                lon: mountain.lon + (Math.random() - 0.5) * 0.1
            },
            radius: mountain.radius * (0.8 + Math.random() * 0.4),
            intensity: 15 + Math.random() * 25,
            movement: { latSpeed: 0, lonSpeed: 0.001 },
            lifetime: 300,
            age: Math.random() * 100
        };
    }

    updateWeatherSystems(deltaMinutes = 10) {
        this.timeOffset += deltaMinutes;

        // Update existing systems
        this.weatherSystems = this.weatherSystems.map(system => {
            system.age += deltaMinutes;

            // Move the system
            system.center.lat += system.movement.latSpeed * deltaMinutes;
            system.center.lon += system.movement.lonSpeed * deltaMinutes;

            // Intensity decay over time
            const ageRatio = system.age / system.lifetime;
            if (ageRatio > 0.7) {
                system.intensity *= (1 - (ageRatio - 0.7) * 2);
            }

            return system;
        }).filter(system => system.age < system.lifetime && system.intensity > 5);

        // Add new systems occasionally
        if (Math.random() < 0.3) {
            const systemTypes = ['shower', 'thunderstorm', 'rainband', 'mountain'];
            const randomType = systemTypes[Math.floor(Math.random() * systemTypes.length)];

            switch (randomType) {
                case 'shower':
                    this.weatherSystems.push(this.createLocalizedShower());
                    break;
                case 'thunderstorm':
                    this.weatherSystems.push(this.createThunderstormCluster());
                    break;
                case 'rainband':
                    this.weatherSystems.push(this.createRainBand());
                    break;
                case 'mountain':
                    this.weatherSystems.push(this.createMountainPrecipitation());
                    break;
            }
        }
    }

    calculatePrecipitationAtPoint(lat, lon) {
        let totalIntensity = 0;

        this.weatherSystems.forEach(system => {
            if (!system || !system.center) return; // Skip invalid systems

            const distance = this.calculateDistance(lat, lon, system.center.lat, system.center.lon);
            let intensity = 0;

            switch (system.type) {
                case 'thunderstorm':
                case 'shower':
                case 'mountain':
                    if (system.radius && system.intensity && distance <= system.radius) {
                        const falloff = 1 - (distance / system.radius);
                        intensity = system.intensity * Math.pow(falloff, 1.5);
                    }
                    break;

                case 'rainband':
                    if (system.start && system.end && system.width) {
                        const distanceToLine = this.distanceToRainBand(lat, lon, system);
                        if (distanceToLine <= system.width) {
                            const falloff = 1 - (distanceToLine / system.width);
                            intensity = system.intensity * falloff;
                        }
                    }
                    break;
            }

            totalIntensity += intensity;
        });

        // Add geographic modifiers
        totalIntensity *= this.getGeographicModifier(lat, lon);

        // Add some noise for realism
        totalIntensity += (Math.random() - 0.5) * 5;

        return Math.max(0, Math.min(100, totalIntensity));
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const dlat = lat2 - lat1;
        const dlon = lon2 - lon1;
        return Math.sqrt(dlat * dlat + dlon * dlon);
    }

    distanceToRainBand(lat, lon, rainband) {
        const { start, end } = rainband;

        // Calculate perpendicular distance to the line
        const A = lat - start.lat;
        const B = lon - start.lon;
        const C = end.lat - start.lat;
        const D = end.lon - start.lon;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return this.calculateDistance(lat, lon, start.lat, start.lon);

        const param = dot / lenSq;

        let closestLat, closestLon;
        if (param < 0) {
            closestLat = start.lat;
            closestLon = start.lon;
        } else if (param > 1) {
            closestLat = end.lat;
            closestLon = end.lon;
        } else {
            closestLat = start.lat + param * C;
            closestLon = start.lon + param * D;
        }

        return this.calculateDistance(lat, lon, closestLat, closestLon);
    }

    getGeographicModifier(lat, lon) {
        let modifier = 1.0;

        // Mountains get more precipitation
        this.mountainRanges.forEach(mountain => {
            const distance = this.calculateDistance(lat, lon, mountain.lat, mountain.lon);
            if (distance <= mountain.radius) {
                const proximity = 1 - (distance / mountain.radius);
                modifier += proximity * 0.3; // 30% more precipitation in mountains
            }
        });

        // Coastal areas (lower altitudes) get slightly less
        if (lon < 13.5) { // Near coast
            modifier *= 0.9;
        }

        return modifier;
    }

    generateCurrentData() {
        const features = [];

        this.sloveniaGrid.forEach(point => {
            const intensity = this.calculatePrecipitationAtPoint(point.lat, point.lon);

            if (intensity > 2) { // Only include significant precipitation
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [point.lon, point.lat]
                    },
                    properties: {
                        intensity: Math.round(intensity * 10) / 10,
                        timestamp: new Date().toISOString(),
                        color: this.getColorForIntensity(intensity),
                        altitude: this.getAltitudeForIntensity(intensity),
                        source: 'dummy'
                    }
                });
            }
        });

        return {
            type: 'FeatureCollection',
            features,
            metadata: {
                timestamp: new Date().toISOString(),
                source: 'Dummy Weather Generator',
                coverage: 'Slovenia',
                resolution: '~4km',
                activeSystems: this.weatherSystems.length
            }
        };
    }

    generateHistoricalSequence(durationMinutes = 120, intervalMinutes = 10) {
        const sequence = [];
        const savedSystems = JSON.parse(JSON.stringify(this.weatherSystems));
        const savedTimeOffset = this.timeOffset;

        // Go back in time
        this.timeOffset -= durationMinutes;

        // Regenerate weather systems for the past
        this.initializeWeatherSystems();

        for (let minutes = -durationMinutes; minutes <= 0; minutes += intervalMinutes) {
            this.updateWeatherSystems(intervalMinutes);

            const timestamp = new Date(Date.now() + minutes * 60 * 1000);
            const data = this.generateCurrentData();
            data.metadata.timestamp = timestamp.toISOString();

            sequence.push({
                timestamp,
                data
            });
        }

        // Restore current state
        this.weatherSystems = savedSystems;
        this.timeOffset = savedTimeOffset;

        return sequence;
    }

    getColorForIntensity(intensity) {
        if (intensity <= 0) return '#FFFFFF';
        if (intensity <= 25) return '#00FF00';
        if (intensity <= 50) return '#FFFF00';
        if (intensity <= 75) return '#FFA500';
        return '#FF0000';
    }

    getAltitudeForIntensity(intensity) {
        if (intensity <= 0) return 0;
        if (intensity <= 25) return 1500;
        if (intensity <= 50) return 3000;
        if (intensity <= 75) return 4500;
        return 6000;
    }

    // Method to advance time for real-time updates
    advanceTime(minutes = 10) {
        this.updateWeatherSystems(minutes);
        return this.generateCurrentData();
    }

    getSystemInfo() {
        return {
            activeSystems: this.weatherSystems.length,
            systemTypes: this.weatherSystems.map(s => s.type),
            timeOffset: this.timeOffset,
            coverageArea: this.sloveniaGrid.length
        };
    }
}