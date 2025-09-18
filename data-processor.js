export class AirspaceDataProcessor {
    static FEET_TO_METERS = 0.3048;
    
    static convertAltitude(altitudeData) {
        if (!altitudeData || typeof altitudeData.value !== 'number') {
            return 0;
        }
        
        const { value, unit, referenceDatum } = altitudeData;
        
        let altitudeInMeters;
        if (unit === 1) {
            // Unit 1: feet
            altitudeInMeters = value * this.FEET_TO_METERS;
        } else if (unit === 6) {
            // Unit 6: hundreds of feet (multiply by 100, then convert to meters)
            altitudeInMeters = value * 100 * this.FEET_TO_METERS;
        } else {
            // Default: assume meters
            altitudeInMeters = value;
        }
        
        return {
            altitude: Math.max(0, altitudeInMeters),
            isAGL: referenceDatum === 0,
            isMSL: referenceDatum === 1
        };
    }
    
    static processAirspaceFeature(feature) {
        const properties = feature.properties;
        const geometry = feature.geometry;
        
        if (!properties || !geometry || geometry.type !== 'Polygon') {
            return null;
        }
        
        const lowerLimit = this.convertAltitude(properties.lowerLimit);
        const upperLimit = this.convertAltitude(properties.upperLimit);
        
        return {
            id: feature.id || properties._id,
            name: properties.name || 'Unknown Airspace',
            icaoClass: properties.icaoClass || 6,
            type: properties.type || 0,
            country: properties.country || '',
            lowerAltitude: lowerLimit.altitude,
            upperAltitude: upperLimit.altitude,
            isLowerAGL: lowerLimit.isAGL,
            isUpperAGL: upperLimit.isAGL,
            coordinates: geometry.coordinates[0],
            frequencies: properties.frequencies || [],
            operatingHours: properties.hoursOfOperation?.operatingHours || [],
            restrictions: {
                onDemand: properties.onDemand || false,
                onRequest: properties.onRequest || false,
                byNotam: properties.byNotam || false,
                specialAgreement: properties.specialAgreement || false,
                requestCompliance: properties.requestCompliance || false
            },
            rawProperties: properties
        };
    }
    
    static processGeoJSON(geoJsonData) {
        if (!geoJsonData || !geoJsonData.features) {
            throw new Error('Invalid GeoJSON data');
        }
        
        return geoJsonData.features
            .map(feature => this.processAirspaceFeature(feature))
            .filter(airspace => airspace !== null);
    }
    
    static coordinatesToCartesian3Array(coordinates) {
        return coordinates.map(coord => {
            const [longitude, latitude] = coord;
            return [longitude, latitude];
        }).flat();
    }
    
    static getAirspaceHeight(airspace, terrainHeight = 0) {
        let lowerHeight = airspace.lowerAltitude;
        let upperHeight = airspace.upperAltitude;
        
        if (airspace.isLowerAGL) {
            lowerHeight += terrainHeight;
        }
        
        if (airspace.isUpperAGL) {
            upperHeight += terrainHeight;
        }
        
        return {
            bottom: Math.max(0, lowerHeight),
            top: Math.max(lowerHeight, upperHeight)
        };
    }
    
    static formatAltitude(altitude, isAGL = false) {
        const altitudeInFeet = Math.round(altitude / this.FEET_TO_METERS);
        const reference = isAGL ? 'AGL' : 'MSL';
        return `${altitudeInFeet} ft ${reference}`;
    }
}