import { AirspaceClassifier } from './airspace-classifier.js';
import { AirspaceDataProcessor } from './data-processor.js';

export class AirspaceUIControls {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.altitudeSlider = null;
        this.labelToggle = null;
        this.legend = null;
        this.infoPanel = null;
        this.statsDisplay = null;
        
        this.currentAltitude = 20000;
        this.showLabels = true;
        this.selectedAirspace = null;
        
        this.initializeControls();
        this.setupEventListeners();
    }
    
    initializeControls() {
        this.createAltitudeSlider();
        this.createLabelToggle();
        this.createLegend();
        this.createInfoPanel();
        this.createStatsDisplay();
    }
    
    createAltitudeSlider() {
        const container = document.createElement('div');
        container.className = 'airspace-control altitude-slider';
        container.innerHTML = `
            <div class="control-header">
                <label for="altitudeSlider">Altitude Filter</label>
                <span class="altitude-value">${this.formatAltitudeDisplay(this.currentAltitude)}</span>
            </div>
            <input type="range" id="altitudeSlider" 
                   min="0" max="20000" step="100" value="${this.currentAltitude}">
            <div class="slider-labels">
                <span>0m</span>
                <span>20km</span>
            </div>
        `;
        
        this.altitudeSlider = container.querySelector('#altitudeSlider');
        this.altitudeValue = container.querySelector('.altitude-value');
        
        document.body.appendChild(container);
        return container;
    }
    
    createLabelToggle() {
        const container = document.createElement('div');
        container.className = 'airspace-control label-toggle';
        container.innerHTML = `
            <label>
                <input type="checkbox" id="labelToggle" ${this.showLabels ? 'checked' : ''}>
                <span class="toggle-text">Show Labels</span>
            </label>
        `;
        
        this.labelToggle = container.querySelector('#labelToggle');
        document.body.appendChild(container);
        return container;
    }
    
    createLegend() {
        const container = document.createElement('div');
        container.className = 'airspace-control legend-panel';
        container.innerHTML = `
            <div class="control-header">
                <h3>Airspace Classes</h3>
                <button class="toggle-legend" title="Toggle Legend">▼</button>
            </div>
            <div class="legend-content">
                ${this.generateLegendHTML()}
            </div>
        `;
        
        this.legend = container;
        document.body.appendChild(container);
        return container;
    }
    
    createInfoPanel() {
        const container = document.createElement('div');
        container.className = 'airspace-control info-panel';
        container.innerHTML = `
            <div class="control-header">
                <h3>Airspace Information</h3>
                <button class="close-info" title="Close">✕</button>
            </div>
            <div class="info-content">
                <p>Click on an airspace to see detailed information</p>
            </div>
        `;
        
        this.infoPanel = container;
        this.infoPanel.style.display = 'none';
        document.body.appendChild(container);
        return container;
    }
    
    createStatsDisplay() {
        const container = document.createElement('div');
        container.className = 'airspace-control stats-display';
        container.innerHTML = `
            <div class="control-header">
                <h3>Statistics</h3>
            </div>
            <div class="stats-content">
                <div class="stat-item">
                    <span class="stat-label">Total:</span>
                    <span class="stat-value" id="totalAirspaces">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Visible:</span>
                    <span class="stat-value" id="visibleAirspaces">0</span>
                </div>
            </div>
        `;
        
        this.statsDisplay = container;
        document.body.appendChild(container);
        return container;
    }
    
    setupEventListeners() {
        if (this.altitudeSlider) {
            this.altitudeSlider.addEventListener('input', (e) => {
                this.currentAltitude = parseInt(e.target.value);
                this.altitudeValue.textContent = this.formatAltitudeDisplay(this.currentAltitude);
                this.visualizer.setAltitudeFilter(this.currentAltitude);
                this.updateStats();
            });
        }
        
        if (this.labelToggle) {
            this.labelToggle.addEventListener('change', (e) => {
                this.showLabels = e.target.checked;
                this.visualizer.setShowLabels(this.showLabels);
            });
        }
        
        const legendToggle = this.legend?.querySelector('.toggle-legend');
        if (legendToggle) {
            legendToggle.addEventListener('click', () => {
                this.toggleLegend();
            });
        }
        
        const closeInfo = this.infoPanel?.querySelector('.close-info');
        if (closeInfo) {
            closeInfo.addEventListener('click', () => {
                this.hideInfoPanel();
            });
        }
        
        this.visualizer.onAirspaceClick((airspace) => {
            this.showAirspaceInfo(airspace);
        });
        
        this.visualizer.onAirspaceHover((airspace) => {
            if (airspace) {
                this.visualizer.highlightAirspace(airspace.id, true);
            }
        });
    }
    
    generateLegendHTML() {
        const legendData = AirspaceClassifier.getLegendData();
        
        return legendData.map(item => `
            <div class="legend-item">
                <div class="color-swatch" style="background-color: ${item.hexColor}"></div>
                <div class="legend-text">
                    <strong>${item.name}</strong>
                    <br>
                    <small>${item.description}</small>
                </div>
            </div>
        `).join('');
    }
    
    showAirspaceInfo(airspace) {
        if (!this.infoPanel) return;
        
        this.selectedAirspace = airspace;
        
        const classification = AirspaceClassifier.getClassificationInfo(airspace.icaoClass);
        const typeInfo = AirspaceClassifier.getTypeInfo(airspace.type);
        
        const infoHTML = `
            <div class="airspace-details">
                <h4>${airspace.name}</h4>
                
                <div class="detail-section">
                    <strong>Classification:</strong> ${classification.name}
                    <br>
                    <strong>Type:</strong> ${typeInfo.name}
                    <br>
                    <strong>Country:</strong> ${airspace.country}
                </div>
                
                <div class="detail-section">
                    <strong>Altitude Limits:</strong>
                    <br>
                    Lower: ${AirspaceDataProcessor.formatAltitude(airspace.lowerAltitude, airspace.isLowerAGL)}
                    <br>
                    Upper: ${AirspaceDataProcessor.formatAltitude(airspace.upperAltitude, airspace.isUpperAGL)}
                </div>
                
                ${airspace.frequencies.length > 0 ? `
                    <div class="detail-section">
                        <strong>Frequencies:</strong>
                        ${airspace.frequencies.map(freq => `
                            <br>${freq.name}: ${freq.value} MHz
                        `).join('')}
                    </div>
                ` : ''}
                
                ${Object.values(airspace.restrictions).some(r => r) ? `
                    <div class="detail-section">
                        <strong>Restrictions:</strong>
                        ${Object.entries(airspace.restrictions)
                            .filter(([key, value]) => value)
                            .map(([key, value]) => `<br>• ${this.formatRestrictionName(key)}`)
                            .join('')}
                    </div>
                ` : ''}
                
                <div class="detail-actions">
                    <button onclick="airspaceControls.focusOnAirspace('${airspace.id}')">
                        Focus on Airspace
                    </button>
                </div>
            </div>
        `;
        
        this.infoPanel.querySelector('.info-content').innerHTML = infoHTML;
        this.infoPanel.style.display = 'block';
    }
    
    hideInfoPanel() {
        if (this.infoPanel) {
            this.infoPanel.style.display = 'none';
        }
        
        if (this.selectedAirspace) {
            this.visualizer.unhighlightAirspace(this.selectedAirspace.id);
            this.selectedAirspace = null;
        }
    }
    
    toggleLegend() {
        const content = this.legend.querySelector('.legend-content');
        const button = this.legend.querySelector('.toggle-legend');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            button.textContent = '▼';
        } else {
            content.style.display = 'none';
            button.textContent = '▶';
        }
    }
    
    updateStats() {
        const stats = this.visualizer.getStatistics();
        
        const totalElement = document.getElementById('totalAirspaces');
        const visibleElement = document.getElementById('visibleAirspaces');
        
        if (totalElement) totalElement.textContent = stats.total;
        if (visibleElement) visibleElement.textContent = stats.visible;
    }
    
    focusOnAirspace(airspaceId) {
        this.visualizer.focusOnAirspace(airspaceId);
    }
    
    formatAltitudeDisplay(altitude) {
        if (altitude >= 1000) {
            return `${(altitude / 1000).toFixed(1)}km`;
        }
        return `${altitude}m`;
    }
    
    formatRestrictionName(key) {
        const names = {
            onDemand: 'On Demand',
            onRequest: 'On Request',
            byNotam: 'By NOTAM',
            specialAgreement: 'Special Agreement Required',
            requestCompliance: 'Request Compliance Required'
        };
        
        return names[key] || key;
    }
    
    destroy() {
        const controls = document.querySelectorAll('.airspace-control');
        controls.forEach(control => control.remove());
    }
}