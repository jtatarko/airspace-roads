// aircraft-ui-controls.js
// Aircraft-specific UI controls that integrate with existing airspace controls

import { AircraftClassifier } from "./aircraft-classifier.js";
import { AircraftCategories, AircraftConfig } from "./aircraft-types.js";

/**
 * Aircraft UI controls that extend the existing control system
 * Integrates seamlessly with the current airspace control panels
 */
export class AircraftUIControls {
  constructor(aircraftTracker) {
    this.tracker = aircraftTracker;

    // Control elements
    this.controlPanel = null;
    this.statusPanel = null;
    this.filterPanel = null;
    this.infoPanel = null;
    this.aircraftStatsPanel = null;

    // State
    this.isVisible = false;
    this.selectedAircraft = null;
    this.currentFilters = {
      types: ["all"],
      altitudeRange: { min: 0, max: 50000 },
      speedRange: { min: 0, max: 1000 },
      activeOnly: true,
      searchTerm: "",
    };

    this.initializeControls();
    this.setupEventListeners();

    // Start periodic UI updates (every second)
    this.uiUpdateTimer = setInterval(() => {
      this.updateAPIUsage();
    }, 1000);
  }

  /**
   * Initialize all aircraft control panels
   */
  initializeControls() {
    this.createMainControlPanel();
    this.createStatusPanel();
    this.createFilterPanel();
    this.createInfoPanel();
    this.createStatsPanel();
    this.hide(); // Start hidden
  }

  /**
   * Create main aircraft control panel
   */
  createMainControlPanel() {
    const container = document.createElement("div");
    container.className = "airspace-control aircraft-main-control";
    container.style.cssText = `
            top: 10px;
            left: 250px;
            width: 300px;
            z-index: 1001;
        `;

    container.innerHTML = `
            <div class="control-header">
                <h3>✈️ Aircraft Tracking</h3>
                <button class="toggle-aircraft" title="Toggle Aircraft Panel">▼</button>
            </div>
            <div class="aircraft-control-content">
                <div class="control-section">
                    <div class="aircraft-actions">
                        <button id="startTracking" class="action-btn primary">Start</button>
                        <button id="stopTracking" class="action-btn secondary" disabled>Stop</button>
                        <button id="pauseTracking" class="action-btn secondary" disabled>Pause</button>
                        <button id="testAPI" class="action-btn secondary">Test API</button>
                    </div>
                </div>

                <div class="control-section">
                    <label class="control-label">
                        <input type="checkbox" id="showAircraftLabels" ${
                          AircraftConfig.showLabels ? "checked" : ""
                        }>
                        Show Aircraft Labels
                    </label>
                    <label class="control-label">
                        <input type="checkbox" id="showAircraftTrails" ${
                          AircraftConfig.showTrails ? "checked" : ""
                        }>
                        Show Flight Trails
                    </label>
                </div>

                <div class="control-section">
                    <label for="trackingRegion">Tracking Region:</label>
                    <select id="trackingRegion" class="control-select">
                        <option value="slovenia">Slovenia</option>
                        <option value="custom">Custom Area</option>
                        <option value="global">Global (Limited)</option>
                    </select>
                </div>
            </div>
        `;

    this.controlPanel = container;
    document.body.appendChild(container);

    // Get control elements
    this.elements = {
      startBtn: container.querySelector("#startTracking"),
      stopBtn: container.querySelector("#stopTracking"),
      pauseBtn: container.querySelector("#pauseTracking"),
      testBtn: container.querySelector("#testAPI"),
      labelsToggle: container.querySelector("#showAircraftLabels"),
      trailsToggle: container.querySelector("#showAircraftTrails"),
      regionSelect: container.querySelector("#trackingRegion"),
      toggleBtn: container.querySelector(".toggle-aircraft"),
      content: container.querySelector(".aircraft-control-content"),
    };
  }

  /**
   * Create aircraft status panel
   */
  createStatusPanel() {
    const container = document.createElement("div");
    container.className = "airspace-control aircraft-status";
    container.style.cssText = `
            top: 10px;
            left: 570px;
            width: 250px;
            z-index: 1001;
        `;

    container.innerHTML = `
            <div class="control-header">
                <h3>📡 Connection Status</h3>
            </div>
            <div class="status-content">
                <div class="status-item">
                    <span class="status-label">Status:</span>
                    <span class="status-value" id="aircraftStatus">Stopped</span>
                </div>
                <div class="status-item">
                    <span class="status-label">API Requests:</span>
                    <span class="status-value" id="apiRequests">0/400</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Next Update:</span>
                    <span class="status-value" id="nextUpdate">--</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Error:</span>
                    <span class="status-value error" id="lastError">None</span>
                </div>
            </div>
        `;

    this.statusPanel = container;
    document.body.appendChild(container);
  }

  /**
   * Create aircraft filter panel
   */
  createFilterPanel() {
    const container = document.createElement("div");
    container.className = "airspace-control aircraft-filters";
    container.style.cssText = `
            top: 160px;
            left: 250px;
            width: 300px;
            z-index: 1001;
        `;

    container.innerHTML = `
            <div class="control-header">
                <h3>🔍 Aircraft Filters</h3>
                <button class="toggle-filters" title="Toggle Filters">▼</button>
            </div>
            <div class="filter-content">
                <div class="filter-section">
                    <label>Aircraft Types:</label>
                    <div class="type-filters">
                        <label class="type-filter">
                            <input type="checkbox" value="all" checked> All Types
                        </label>
                        ${this.generateTypeFilterHTML()}
                    </div>
                </div>

                <div class="filter-section">
                    <label for="altitudeRange">Altitude Range (ft):</label>
                    <div class="range-inputs">
                        <input type="number" id="minAltitude" placeholder="Min" value="0" min="0" max="50000">
                        <span>-</span>
                        <input type="number" id="maxAltitude" placeholder="Max" value="50000" min="0" max="50000">
                    </div>
                </div>

                <div class="filter-section">
                    <label for="speedRange">Speed Range (kts):</label>
                    <div class="range-inputs">
                        <input type="number" id="minSpeed" placeholder="Min" value="0" min="0" max="1000">
                        <span>-</span>
                        <input type="number" id="maxSpeed" placeholder="Max" value="1000" min="0" max="1000">
                    </div>
                </div>

                <div class="filter-section">
                    <label class="control-label">
                        <input type="checkbox" id="activeOnlyFilter" checked>
                        Active Aircraft Only
                    </label>
                </div>

                <div class="filter-section">
                    <label for="aircraftSearch">Search Aircraft:</label>
                    <input type="text" id="aircraftSearch" placeholder="Callsign or ICAO24" class="search-input">
                </div>
            </div>
        `;

    this.filterPanel = container;
    document.body.appendChild(container);
  }

  /**
   * Generate HTML for aircraft type filters
   */
  generateTypeFilterHTML() {
    return Object.values(AircraftCategories)
      .filter((cat) => cat.id !== "unknown")
      .map(
        (category) => `
                <label class="type-filter">
                    <input type="checkbox" value="${category.id}">
                    <span class="type-color" style="background-color: ${category.color}"></span>
                    ${category.name}
                </label>
            `
      )
      .join("");
  }

  /**
   * Create aircraft information panel
   */
  createInfoPanel() {
    const container = document.createElement("div");
    container.className = "airspace-control aircraft-info";
    container.style.cssText = `
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 400px;
            max-height: 500px;
            overflow-y: auto;
            z-index: 1002;
            display: none;
        `;

    container.innerHTML = `
            <div class="control-header">
                <h3>✈️ Aircraft Information</h3>
                <button class="close-aircraft-info" title="Close">✕</button>
            </div>
            <div class="aircraft-info-content">
                <p>Click on an aircraft to see detailed information</p>
            </div>
        `;

    this.infoPanel = container;
    document.body.appendChild(container);
  }

  /**
   * Create aircraft statistics panel
   */
  createStatsPanel() {
    const container = document.createElement("div");
    container.className = "airspace-control aircraft-stats";
    container.style.cssText = `
            bottom: 120px;
            left: 10px;
            width: 250px;
            z-index: 1001;
        `;

    container.innerHTML = `
            <div class="control-header">
                <h3>📊 Aircraft Statistics</h3>
            </div>
            <div class="stats-content">
                <div class="stat-item">
                    <span class="stat-label">Total Aircraft:</span>
                    <span class="stat-value" id="totalAircraft">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Visible:</span>
                    <span class="stat-value" id="visibleAircraft">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">In Flight:</span>
                    <span class="stat-value" id="inFlightAircraft">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">On Ground:</span>
                    <span class="stat-value" id="onGroundAircraft">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Altitude:</span>
                    <span class="stat-value" id="avgAltitude">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Speed:</span>
                    <span class="stat-value" id="avgSpeed">--</span>
                </div>
            </div>
        `;

    this.aircraftStatsPanel = container;
    document.body.appendChild(container);
  }

  /**
   * Setup event listeners for all controls
   */
  setupEventListeners() {
    // Main control actions
    this.elements.startBtn.addEventListener("click", () =>
      this.startTracking()
    );
    this.elements.stopBtn.addEventListener("click", () => this.stopTracking());
    this.elements.pauseBtn.addEventListener("click", () => this.togglePause());
    this.elements.testBtn.addEventListener("click", () => this.testAPI());

    // Display toggles
    this.elements.labelsToggle.addEventListener("change", (e) => {
      this.tracker.visualizer.setShowLabels(e.target.checked);
    });

    this.elements.trailsToggle.addEventListener("change", (e) => {
      this.tracker.visualizer.setShowTrails(e.target.checked);
    });

    // Region selection
    this.elements.regionSelect.addEventListener("change", (e) => {
      this.tracker.setRegion(e.target.value);
    });

    // Panel toggles
    this.elements.toggleBtn.addEventListener("click", () =>
      this.toggleMainPanel()
    );

    const toggleFilters = this.filterPanel.querySelector(".toggle-filters");
    toggleFilters.addEventListener("click", () => this.toggleFilterPanel());

    const closeInfo = this.infoPanel.querySelector(".close-aircraft-info");
    closeInfo.addEventListener("click", () => this.hideAircraftInfo());

    // Filter controls
    this.setupFilterListeners();

    // Tracker event handlers
    this.tracker.onAircraftUpdate((event) => this.handleAircraftUpdate(event));
    this.tracker.onError((error) => this.handleError(error));
    this.tracker.onStatusChange((status) => this.handleStatusChange(status));
  }

  /**
   * Setup filter event listeners
   */
  setupFilterListeners() {
    const filterContainer = this.filterPanel.querySelector(".filter-content");

    // Type filters
    const typeCheckboxes = filterContainer.querySelectorAll(
      '.type-filters input[type="checkbox"]'
    );
    typeCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => this.updateTypeFilters());
    });

    // Range filters
    ["minAltitude", "maxAltitude", "minSpeed", "maxSpeed"].forEach((id) => {
      const input = filterContainer.querySelector(`#${id}`);
      input.addEventListener("change", () => this.updateRangeFilters());
    });

    // Active only filter
    const activeFilter = filterContainer.querySelector("#activeOnlyFilter");
    activeFilter.addEventListener("change", (e) => {
      this.currentFilters.activeOnly = e.target.checked;
      this.applyFilters();
    });

    // Search filter
    const searchInput = filterContainer.querySelector("#aircraftSearch");
    searchInput.addEventListener("input", (e) => {
      this.currentFilters.searchTerm = e.target.value;
      this.applyFilters();
    });
  }

  /**
   * Update type filters based on checkbox states
   */
  updateTypeFilters() {
    const checkboxes = this.filterPanel.querySelectorAll(
      '.type-filters input[type="checkbox"]'
    );
    const allCheckbox = this.filterPanel.querySelector('input[value="all"]');

    if (allCheckbox.checked) {
      // If "all" is checked, uncheck others and use 'all'
      checkboxes.forEach((cb) => {
        if (cb !== allCheckbox) cb.checked = false;
      });
      this.currentFilters.types = ["all"];
    } else {
      // Collect selected types
      const selectedTypes = Array.from(checkboxes)
        .filter((cb) => cb.checked && cb.value !== "all")
        .map((cb) => cb.value);

      if (selectedTypes.length === 0) {
        // If none selected, check "all"
        allCheckbox.checked = true;
        this.currentFilters.types = ["all"];
      } else {
        this.currentFilters.types = selectedTypes;
      }
    }

    this.applyFilters();
  }

  /**
   * Update range filters
   */
  updateRangeFilters() {
    const minAlt =
      parseInt(this.filterPanel.querySelector("#minAltitude").value) || 0;
    const maxAlt =
      parseInt(this.filterPanel.querySelector("#maxAltitude").value) || 50000;
    const minSpeed =
      parseInt(this.filterPanel.querySelector("#minSpeed").value) || 0;
    const maxSpeed =
      parseInt(this.filterPanel.querySelector("#maxSpeed").value) || 1000;

    this.currentFilters.altitudeRange = { min: minAlt, max: maxAlt };
    this.currentFilters.speedRange = { min: minSpeed, max: maxSpeed };

    this.applyFilters();
  }

  /**
   * Apply current filters to aircraft visualization
   */
  applyFilters() {
    this.tracker.setFilters(this.currentFilters);
  }

  /**
   * Test API connection
   */
  async testAPI() {
    try {
      this.elements.testBtn.disabled = true;
      this.elements.testBtn.textContent = "Testing...";

      const result = await this.tracker.apiService.testConnection();

      if (result.success) {
        console.log(
          `API test successful: ${result.aircraftCount} aircraft found`
        );
        this.handleStatusChange({
          status: "tested",
          message: `API test successful: ${result.aircraftCount} aircraft found`,
        });
      } else {
        console.error(`API test failed: ${result.error}`);
        this.handleError(new Error(result.error));
      }
    } catch (error) {
      console.error("API test failed:", error);
      this.handleError(error);
    } finally {
      this.elements.testBtn.disabled = false;
      this.elements.testBtn.textContent = "Test API";
    }
  }

  /**
   * Start aircraft tracking
   */
  async startTracking() {
    try {
      this.elements.startBtn.disabled = true;
      this.elements.startBtn.textContent = "Starting...";

      await this.tracker.start();

      this.elements.startBtn.disabled = true;
      this.elements.stopBtn.disabled = false;
      this.elements.pauseBtn.disabled = false;
      this.elements.testBtn.disabled = true;
      this.elements.startBtn.textContent = "Start Tracking";
    } catch (error) {
      this.elements.startBtn.disabled = false;
      this.elements.startBtn.textContent = "Start Tracking";
      console.error("Failed to start tracking:", error);
      this.handleError(error);
    }
  }

  /**
   * Stop aircraft tracking
   */
  stopTracking() {
    this.tracker.stop();

    this.elements.startBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
    this.elements.pauseBtn.disabled = true;
    this.elements.testBtn.disabled = false;
    this.elements.pauseBtn.textContent = "Pause";
  }

  /**
   * Toggle pause/resume
   */
  togglePause() {
    const stats = this.tracker.getStatistics();

    if (stats.tracking.isPaused) {
      this.tracker.resume();
      this.elements.pauseBtn.textContent = "Pause";
    } else {
      this.tracker.pause();
      this.elements.pauseBtn.textContent = "Resume";
    }
  }

  /**
   * Handle aircraft update events
   */
  handleAircraftUpdate(event) {
    if (event.type === "data_updated") {
      this.updateStatistics(event.stats);
    } else if (event.type === "aircraft_selected") {
      this.showAircraftInfo(event.aircraft);
    }
  }

  /**
   * Handle error events
   */
  handleError(error) {
    const errorElement = document.getElementById("lastError");
    if (errorElement) {
      errorElement.textContent = error.message;
      errorElement.title = error.message;
    }
  }

  /**
   * Handle status change events
   */
  handleStatusChange(status) {
    const statusElement = document.getElementById("aircraftStatus");
    if (statusElement) {
      let displayStatus = status.status;

      // Special handling for different statuses
      if (status.status === "running") {
        displayStatus = "Running";
      } else if (status.status === "stopped") {
        displayStatus = "Stopped";
      } else if (status.status === "paused") {
        displayStatus = "Paused";
      } else if (status.status === "tested") {
        displayStatus = "API Tested";
        // Reset to previous status after 3 seconds
        setTimeout(() => {
          const currentStats = this.tracker.getStatistics();
          if (currentStats.tracking.isRunning) {
            statusElement.textContent = currentStats.tracking.isPaused
              ? "Paused"
              : "Running";
            statusElement.className = `status-value ${
              currentStats.tracking.isPaused ? "paused" : "running"
            }`;
          } else {
            statusElement.textContent = "Stopped";
            statusElement.className = "status-value stopped";
          }
        }, 3000);
      }

      statusElement.textContent = displayStatus;
      statusElement.className = `status-value ${status.status}`;
    }

    // Update API usage
    this.updateAPIUsage();
  }

  /**
   * Update API usage display
   */
  updateAPIUsage() {
    const stats = this.tracker.getStatistics();
    const apiElement = document.getElementById("apiRequests");

    if (apiElement && stats.api) {
      const used = stats.api.requestsUsed;
      const total = stats.api.dailyLimit;
      apiElement.textContent = `${used}/${total}`;

      if (stats.api.dailyLimitReached) {
        apiElement.className = "status-value error";
      } else if (used > total * 0.8) {
        apiElement.className = "status-value warning";
      } else {
        apiElement.className = "status-value";
      }
    }

    // Update next update timer
    const nextElement = document.getElementById("nextUpdate");
    if (nextElement && stats.api) {
      const timeRemaining = stats.api.timeUntilNextRequest;
      if (timeRemaining > 0) {
        const seconds = Math.ceil(timeRemaining / 1000);
        nextElement.textContent = `${seconds}s`;
      } else {
        nextElement.textContent = "Now";
      }
    }
  }

  /**
   * Update statistics display
   */
  updateStatistics(stats) {
    const elements = {
      totalAircraft: document.getElementById("totalAircraft"),
      visibleAircraft: document.getElementById("visibleAircraft"),
      inFlightAircraft: document.getElementById("inFlightAircraft"),
      onGroundAircraft: document.getElementById("onGroundAircraft"),
      avgAltitude: document.getElementById("avgAltitude"),
      avgSpeed: document.getElementById("avgSpeed"),
    };

    if (elements.totalAircraft)
      elements.totalAircraft.textContent = stats.total;
    if (elements.visibleAircraft)
      elements.visibleAircraft.textContent = stats.visible;
    if (elements.inFlightAircraft)
      elements.inFlightAircraft.textContent = stats.inFlight;
    if (elements.onGroundAircraft)
      elements.onGroundAircraft.textContent = stats.onGround;

    if (elements.avgAltitude && stats.altitudeStats) {
      elements.avgAltitude.textContent =
        stats.altitudeStats.average > 0
          ? `${stats.altitudeStats.average}ft`
          : "--";
    }

    if (elements.avgSpeed && stats.speedStats) {
      elements.avgSpeed.textContent =
        stats.speedStats.average > 0 ? `${stats.speedStats.average}kts` : "--";
    }

    this.updateAPIUsage();
  }

  /**
   * Show detailed aircraft information
   */
  showAircraftInfo(aircraft) {
    this.selectedAircraft = aircraft;

    const infoHTML = `
            <div class="aircraft-details">
                <h4>${aircraft.callsign || aircraft.icao24}</h4>

                <div class="detail-section">
                    <strong>Aircraft Type:</strong> ${
                      aircraft.aircraftType.name
                    }
                    <br>
                    <strong>Origin Country:</strong> ${aircraft.originCountry}
                    <br>
                    <strong>ICAO24:</strong> ${aircraft.icao24}
                </div>

                <div class="detail-section">
                    <strong>Position:</strong>
                    <br>
                    Latitude: ${aircraft.latitude?.toFixed(6)}°
                    <br>
                    Longitude: ${aircraft.longitude?.toFixed(6)}°
                    <br>
                    Altitude: ${aircraft.getFormattedAltitude()}
                </div>

                <div class="detail-section">
                    <strong>Flight Data:</strong>
                    <br>
                    Speed: ${aircraft.getFormattedSpeed()}
                    <br>
                    Heading: ${aircraft.getFormattedHeading()}
                    <br>
                    Status: ${aircraft.getStatus()}
                </div>

                <div class="detail-section">
                    <strong>Contact Info:</strong>
                    <br>
                    Last Contact: ${aircraft.getTimeSinceContact()}
                    <br>
                    Updates: ${aircraft.updateCount}
                    ${aircraft.squawk ? `<br>Squawk: ${aircraft.squawk}` : ""}
                </div>

                <div class="detail-actions">
                    <button onclick="aircraftControls.focusOnAircraft('${
                      aircraft.icao24
                    }')">
                        Follow Aircraft
                    </button>
                </div>
            </div>
        `;

    const contentElement = this.infoPanel.querySelector(".aircraft-info-content");
    // Clear any existing content first
    contentElement.innerHTML = "";
    // Add the new content
    contentElement.innerHTML = infoHTML;
    this.infoPanel.style.display = "block";
  }

  /**
   * Hide aircraft information panel
   */
  hideAircraftInfo() {
    this.infoPanel.style.display = "none";

    // Reset to empty state
    const contentElement = this.infoPanel.querySelector(".aircraft-info-content");
    contentElement.innerHTML = "<p>Click on an aircraft to see detailed information</p>";

    if (this.selectedAircraft) {
      this.tracker.visualizer.selectAircraft(
        this.selectedAircraft.icao24,
        false
      );
      this.selectedAircraft = null;
    }
  }

  /**
   * Focus on specific aircraft
   */
  focusOnAircraft(icao24) {
    this.tracker.selectAircraft(icao24);
  }

  /**
   * Toggle main control panel visibility
   */
  toggleMainPanel() {
    const content = this.elements.content;
    const button = this.elements.toggleBtn;

    if (content.style.display === "none") {
      content.style.display = "block";
      button.textContent = "▼";
    } else {
      content.style.display = "none";
      button.textContent = "▶";
    }
  }

  /**
   * Toggle filter panel visibility
   */
  toggleFilterPanel() {
    const content = this.filterPanel.querySelector(".filter-content");
    const button = this.filterPanel.querySelector(".toggle-filters");

    if (content.style.display === "none") {
      content.style.display = "block";
      button.textContent = "▼";
    } else {
      content.style.display = "none";
      button.textContent = "▶";
    }
  }

  /**
   * Show aircraft controls
   */
  show() {
    this.isVisible = true;
    this.controlPanel.style.display = "block";
    this.statusPanel.style.display = "block";
    this.filterPanel.style.display = "block";
    this.aircraftStatsPanel.style.display = "block";
  }

  /**
   * Hide aircraft controls
   */
  hide() {
    this.isVisible = false;
    this.controlPanel.style.display = "none";
    this.statusPanel.style.display = "none";
    this.filterPanel.style.display = "none";
    this.aircraftStatsPanel.style.display = "none";
    this.infoPanel.style.display = "none";
  }

  /**
   * Toggle aircraft controls visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Destroy controls and cleanup
   */
  destroy() {
    // Clear timers
    if (this.uiUpdateTimer) {
      clearInterval(this.uiUpdateTimer);
      this.uiUpdateTimer = null;
    }

    const controls = [
      this.controlPanel,
      this.statusPanel,
      this.filterPanel,
      this.infoPanel,
      this.aircraftStatsPanel,
    ];

    controls.forEach((control) => {
      if (control && control.parentNode) {
        control.parentNode.removeChild(control);
      }
    });

    console.log("Aircraft UI Controls destroyed");
  }
}
