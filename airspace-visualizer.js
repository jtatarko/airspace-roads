import { Entity, PolygonGraphics, LabelGraphics, Cartesian3, Color, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { AirspaceDataProcessor } from './data-processor.js';
import { AirspaceClassifier } from './airspace-classifier.js';

export class AirspaceVisualizer {
    constructor(viewer) {
        this.viewer = viewer;
        this.airspaces = [];
        this.entities = new Map();
        this.showLabels = true;
        this.maxAltitudeFilter = 20000; // 20km default
        this.highlightedAirspace = null;
        
        this.eventHandlers = {
            onAirspaceClick: null,
            onAirspaceHover: null
        };
    }
    
    async loadAirspaceData(geoJsonUrl) {
        try {
            const response = await fetch(geoJsonUrl);
            if (!response.ok) {
                throw new Error(`Failed to load airspace data: ${response.statusText}`);
            }
            
            const geoJsonData = await response.json();
            this.airspaces = AirspaceDataProcessor.processGeoJSON(geoJsonData);
            
            console.log(`Loaded ${this.airspaces.length} airspaces`);
            return this.airspaces;
        } catch (error) {
            console.error('Error loading airspace data:', error);
            throw error;
        }
    }
    
    createAirspaceEntity(airspace) {
        const style = AirspaceClassifier.getVisualizationStyle(airspace, {
            highlighted: false,
            showLabels: this.showLabels
        });
        
        // Debug: Log the color being applied
        console.log(`Airspace ${airspace.name} (class ${airspace.icaoClass}):`, {
            fillColor: style.fillColor,
            outlineColor: style.outlineColor
        });
        
        const heights = AirspaceDataProcessor.getAirspaceHeight(airspace);
        
        const positions = airspace.coordinates.map(coord => 
            Cartesian3.fromDegrees(coord[0], coord[1])
        );
        
        const entity = new Entity({
            id: `airspace_${airspace.id}`,
            name: airspace.name,
            polygon: new PolygonGraphics({
                hierarchy: positions,
                height: heights.bottom,
                extrudedHeight: heights.top,
                fill: style.fill,
                material: style.fillColor,
                outline: style.outline,
                outlineColor: style.outlineColor,
                outlineWidth: style.outlineWidth
            }),
            label: style.showLabel ? new LabelGraphics({
                text: style.labelText,
                font: style.labelStyle.font,
                fillColor: style.labelStyle.fillColor,
                outlineColor: style.labelStyle.outlineColor,
                outlineWidth: style.labelStyle.outlineWidth,
                style: style.labelStyle.style,
                pixelOffset: style.labelStyle.pixelOffset,
                verticalOrigin: VerticalOrigin.BOTTOM,
                horizontalOrigin: HorizontalOrigin.CENTER,
                show: true
            }) : undefined
        });
        
        entity.airspaceData = airspace;
        entity.airspaceStyle = style;
        
        return entity;
    }
    
    renderAirspaces() {
        this.clearAirspaces();
        
        const filteredAirspaces = AirspaceClassifier.filterByAltitude(
            this.airspaces, 
            this.maxAltitudeFilter
        );
        
        filteredAirspaces.forEach(airspace => {
            const entity = this.createAirspaceEntity(airspace);
            this.viewer.entities.add(entity);
            this.entities.set(airspace.id, entity);
        });
        
        console.log(`Rendered ${filteredAirspaces.length} airspaces (filtered from ${this.airspaces.length})`);
    }
    
    clearAirspaces() {
        this.entities.forEach(entity => {
            this.viewer.entities.remove(entity);
        });
        this.entities.clear();
    }
    
    setAltitudeFilter(maxAltitude) {
        this.maxAltitudeFilter = maxAltitude;
        this.renderAirspaces();
    }
    
    setShowLabels(show) {
        this.showLabels = show;
        
        this.entities.forEach(entity => {
            if (entity.label) {
                entity.label.show = show;
            }
        });
    }
    
    highlightAirspace(airspaceId, highlight = true) {
        if (this.highlightedAirspace && this.highlightedAirspace !== airspaceId) {
            this.unhighlightAirspace(this.highlightedAirspace);
        }
        
        const entity = this.entities.get(airspaceId);
        if (!entity) return;
        
        const airspace = entity.airspaceData;
        const style = AirspaceClassifier.getVisualizationStyle(airspace, {
            highlighted: highlight,
            showLabels: this.showLabels
        });
        
        entity.polygon.fillColor = style.fillColor;
        entity.polygon.outlineColor = style.outlineColor;
        entity.polygon.outlineWidth = style.outlineWidth;
        
        if (highlight) {
            this.highlightedAirspace = airspaceId;
        }
    }
    
    unhighlightAirspace(airspaceId) {
        if (this.highlightedAirspace === airspaceId) {
            this.highlightedAirspace = null;
        }
        
        this.highlightAirspace(airspaceId, false);
    }
    
    getAirspaceAtPosition(position) {
        const pickedObject = this.viewer.scene.pick(position);
        
        if (pickedObject && pickedObject.id && pickedObject.id.airspaceData) {
            return pickedObject.id.airspaceData;
        }
        
        return null;
    }
    
    focusOnAirspace(airspaceId) {
        const entity = this.entities.get(airspaceId);
        if (!entity) return;
        
        this.viewer.zoomTo(entity);
        this.highlightAirspace(airspaceId);
    }
    
    getVisibleAirspaces() {
        const camera = this.viewer.camera;
        const visibleAirspaces = [];
        
        this.entities.forEach((entity, airspaceId) => {
            if (entity.isShowing) {
                visibleAirspaces.push(entity.airspaceData);
            }
        });
        
        return visibleAirspaces;
    }
    
    getStatistics() {
        const stats = {
            total: this.airspaces.length,
            visible: this.entities.size,
            byClass: {}
        };
        
        this.airspaces.forEach(airspace => {
            const className = AirspaceClassifier.getClassificationInfo(airspace.icaoClass).name;
            stats.byClass[className] = (stats.byClass[className] || 0) + 1;
        });
        
        return stats;
    }
    
    onAirspaceClick(callback) {
        this.eventHandlers.onAirspaceClick = callback;
    }
    
    onAirspaceHover(callback) {
        this.eventHandlers.onAirspaceHover = callback;
    }
    
    handleClick(position) {
        const airspace = this.getAirspaceAtPosition(position);
        
        if (airspace && this.eventHandlers.onAirspaceClick) {
            this.eventHandlers.onAirspaceClick(airspace, position);
        }
        
        return airspace;
    }
    
    handleHover(position) {
        const airspace = this.getAirspaceAtPosition(position);
        
        if (this.eventHandlers.onAirspaceHover) {
            this.eventHandlers.onAirspaceHover(airspace, position);
        }
        
        return airspace;
    }
    
    destroy() {
        this.clearAirspaces();
        this.airspaces = [];
        this.eventHandlers = {};
    }
}