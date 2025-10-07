import { Entity, PointGraphics, Color, Cartesian3, Cartographic, Math as CesiumMath, HeightReference } from "cesium";

export class RadarPolygonRenderer {
    constructor(viewer) {
        this.viewer = viewer;
        this.radarEntities = [];
        this.cellSize = 0.05; // ~5km cell size in degrees
        this.isVisible = true;
    }

    createPolygonFromPoint(lat, lon, intensity, altitude) {
        // Validate inputs
        if (isNaN(lat) || isNaN(lon) || isNaN(intensity) || isNaN(altitude)) {
            console.warn('Invalid point parameters:', { lat, lon, intensity, altitude });
            return null;
        }

        try {
            const color = this.getColorForIntensity(intensity);
            const opacity = this.getOpacityForIntensity(intensity);

            // Use points instead of polygons for stability
            // Size the points based on intensity and cell size
            const pixelSize = Math.max(10, intensity / 100 * 50);

            return new Entity({
                position: Cartesian3.fromDegrees(lon, lat, altitude),
                point: new PointGraphics({
                    pixelSize: pixelSize,
                    color: color.withAlpha(opacity),
                    outlineColor: Color.TRANSPARENT,
                    outlineWidth: 0,
                    heightReference: HeightReference.RELATIVE_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }),
                properties: {
                    type: 'weather-radar',
                    intensity: intensity,
                    altitude: altitude,
                    lat: lat,
                    lon: lon
                }
            });
        } catch (error) {
            console.error('Error creating point entity:', error);
            return null;
        }
    }

    getColorForIntensity(intensity) {
        if (intensity <= 0) return Color.WHITE;
        if (intensity <= 25) return Color.LIME;      // Bright green
        if (intensity <= 50) return Color.YELLOW;
        if (intensity <= 75) return Color.ORANGE;
        return Color.RED;
    }

    getOpacityForIntensity(intensity) {
        // Map intensity to opacity (0-100 -> 0.1-0.8)
        if (intensity <= 0) return 0.0;
        return Math.max(0.1, Math.min(0.8, intensity / 100 * 0.8));
    }

    renderRadarData(geoJsonData) {
        this.clearRadarData();

        if (!geoJsonData || !geoJsonData.features) {
            console.warn('No radar data to render');
            return;
        }

        console.log(`Rendering ${geoJsonData.features.length} radar cells`);

        geoJsonData.features.forEach(feature => {
            if (feature.geometry.type === 'Point') {
                const [lon, lat] = feature.geometry.coordinates;
                const { intensity, altitude } = feature.properties;

                if (intensity > 0) {
                    const entity = this.createPolygonFromPoint(lat, lon, intensity, altitude);
                    if (entity) { // Only add valid entities
                        entity.show = this.isVisible;
                        this.radarEntities.push(entity);
                        this.viewer.entities.add(entity);
                    }
                }
            }
        });

        console.log(`Added ${this.radarEntities.length} radar entities to scene`);
    }

    clearRadarData() {
        this.radarEntities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.radarEntities = [];
    }

    setVisibility(visible) {
        this.isVisible = visible;
        this.radarEntities.forEach(entity => {
            entity.show = visible;
        });
    }

    getVisibility() {
        return this.isVisible;
    }

    updateOpacity(opacity) {
        this.radarEntities.forEach(entity => {
            const intensity = entity.properties.intensity;
            const baseOpacity = this.getOpacityForIntensity(intensity);
            const newOpacity = baseOpacity * opacity;

            if (entity.polygon && entity.polygon.material) {
                const currentColor = entity.polygon.material.color.getValue();
                entity.polygon.material = currentColor.withAlpha(newOpacity);
            }
        });
    }

    // Method to create interpolated polygons between points for smoother visualization
    createInterpolatedGrid(geoJsonData, interpolationFactor = 2) {
        if (!geoJsonData || !geoJsonData.features) return geoJsonData;

        const features = geoJsonData.features;
        const interpolatedFeatures = [];

        // Create a lookup map for existing points
        const pointMap = new Map();
        features.forEach(feature => {
            if (feature.geometry.type === 'Point') {
                const [lon, lat] = feature.geometry.coordinates;
                const key = `${Math.round(lat * 100)},${Math.round(lon * 100)}`;
                pointMap.set(key, feature);
            }
        });

        // Generate interpolated points
        features.forEach(feature => {
            if (feature.geometry.type === 'Point') {
                const [lon, lat] = feature.geometry.coordinates;
                const intensity = feature.properties.intensity;

                if (intensity > 0) {
                    // Add original point
                    interpolatedFeatures.push(feature);

                    // Add interpolated neighboring points with reduced intensity
                    const step = this.cellSize / interpolationFactor;
                    for (let dLat = -step; dLat <= step; dLat += step) {
                        for (let dLon = -step; dLon <= step; dLon += step) {
                            if (dLat === 0 && dLon === 0) continue; // Skip original point

                            const newLat = lat + dLat;
                            const newLon = lon + dLon;
                            const key = `${Math.round(newLat * 100)},${Math.round(newLon * 100)}`;

                            // Only add if no existing point nearby
                            if (!pointMap.has(key)) {
                                const distance = Math.sqrt(dLat * dLat + dLon * dLon);
                                const falloff = Math.max(0.1, 1 - distance / this.cellSize);
                                const newIntensity = intensity * falloff;

                                if (newIntensity > 5) { // Only add if significant intensity
                                    interpolatedFeatures.push({
                                        type: 'Feature',
                                        geometry: {
                                            type: 'Point',
                                            coordinates: [newLon, newLat]
                                        },
                                        properties: {
                                            intensity: newIntensity,
                                            altitude: this.getAltitudeForIntensity(newIntensity),
                                            interpolated: true
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }
        });

        return {
            ...geoJsonData,
            features: interpolatedFeatures
        };
    }

    getAltitudeForIntensity(intensity) {
        if (intensity <= 0) return 0;
        if (intensity <= 25) return 1500;
        if (intensity <= 50) return 3000;
        if (intensity <= 75) return 4500;
        return 6000;
    }

    getStats() {
        return {
            totalEntities: this.radarEntities.length,
            visible: this.isVisible,
            intensityDistribution: this.getIntensityDistribution()
        };
    }

    getIntensityDistribution() {
        const distribution = { low: 0, moderate: 0, heavy: 0, extreme: 0 };

        this.radarEntities.forEach(entity => {
            const intensity = entity.properties.intensity;
            if (intensity <= 25) distribution.low++;
            else if (intensity <= 50) distribution.moderate++;
            else if (intensity <= 75) distribution.heavy++;
            else distribution.extreme++;
        });

        return distribution;
    }
}