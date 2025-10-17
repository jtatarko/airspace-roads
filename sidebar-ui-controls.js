// sidebar-ui-controls.js
// Unified tabbed sidebar for airspace and aircraft controls

import { AirspaceClassifier } from "./airspace-classifier.js";
import { AircraftConfig } from "./aircraft-types.js";

export class SidebarUIControls {
  constructor(airspaceVisualizer, aircraftTracker, windParticleManager = null) {
    this.airspaceVisualizer = airspaceVisualizer;
    this.aircraftTracker = aircraftTracker;
    this.windParticleManager = windParticleManager;

    // UI state
    this.isCollapsed = false;
    this.activeTab = "airspace";
    this.tabsVisible = true;

    // Control instances
    this.airspaceControls = null;
    this.aircraftControls = null;
    this.weatherControls = null;

    // DOM elements
    this.sidebar = null;
    this.toggleButton = null;
    this.tabContainer = null;
    this.contentContainer = null;

    // Real-time update timer
    this.realTimeUpdateTimer = null;

    this.initialize();
  }

  initialize() {
    this.createSidebar();
    this.setupEventListeners();
    this.initializeTabContent();
    this.startRealTimeUpdates();

    // Defer aircraft adapter setup to ensure tracker is fully initialized
    setTimeout(() => {
      this.setupAircraftAdapters();
    }, 100);
  }

  createSidebar() {
    // Create main sidebar container
    this.sidebar = document.createElement("div");
    this.sidebar.className = "unified-sidebar";
    this.sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-tabs">
                    <button class="tab-button active" data-tab="airspace">
                        <span class="tab-label">Airspace</span>
                    </button>
                    <button class="tab-button" data-tab="aircraft">
                        <span class="tab-label">Aircrafts</span>
                    </button>
                    <button class="tab-button" data-tab="weather">
                        <span class="tab-label">Weather</span>
                    </button>
                </div>
                <button class="sidebar-toggle" title="Toggle Sidebar">
                    <span class="toggle-icon">x</span>
                </button>
            </div>
            <div class="sidebar-content">
                <div class="tab-content active" data-tab="airspace">
                    <!-- Airspace controls will be populated here -->
                </div>
                <div class="tab-content" data-tab="aircraft">
                    <!-- Aircraft controls will be populated here -->
                </div>
                <div class="tab-content" data-tab="weather">
                    <!-- Weather controls will be populated here -->
                </div>
            </div>
        `;

    // Get references to key elements
    this.toggleButton = this.sidebar.querySelector(".sidebar-toggle");
    this.tabContainer = this.sidebar.querySelector(".sidebar-tabs");
    this.contentContainer = this.sidebar.querySelector(".sidebar-content");

    document.body.appendChild(this.sidebar);
  }

  setupEventListeners() {
    // Tab switching
    this.tabContainer.addEventListener("click", (e) => {
      const tabButton = e.target.closest(".tab-button");
      if (tabButton) {
        const tabName = tabButton.dataset.tab;
        this.switchTab(tabName);
      }
    });

    // Sidebar toggle
    this.toggleButton.addEventListener("click", () => {
      this.toggleSidebar();
    });

    // Legend toggle
    const legendToggle = this.sidebar.querySelector("#sidebarLegendToggle");
    if (legendToggle) {
      legendToggle.addEventListener("click", () => {
        this.toggleLegend();
      });
    }

    // Handle escape key to close sidebar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.isCollapsed) {
        this.toggleSidebar();
      }
    });
  }

  switchTab(tabName) {
    // Update active tab
    this.activeTab = tabName;

    // Update tab buttons
    this.tabContainer.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Update tab content
    this.contentContainer
      .querySelectorAll(".tab-content")
      .forEach((content) => {
        content.classList.toggle("active", content.dataset.tab === tabName);
      });

    // Trigger resize event for any charts/components that might need it
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 300);
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebar.classList.toggle("collapsed", this.isCollapsed);

    // Update toggle icon
    const icon = this.toggleButton.querySelector(".toggle-icon");
    icon.textContent = this.isCollapsed ? "⮞" : "⮜";

    // Update toggle button title
    this.toggleButton.title = this.isCollapsed
      ? "Expand Sidebar"
      : "Collapse Sidebar";

    // Trigger resize event
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 300);
  }

  initializeTabContent() {
    this.createAirspaceTabContent();
    this.createAircraftTabContent();
    this.createWeatherTabContent();

    // Setup event listeners for the tab content elements
    this.setupTabEventListeners();
  }

  createAirspaceTabContent() {
    const airspaceTab = this.contentContainer.querySelector(
      '[data-tab="airspace"]'
    );
    airspaceTab.innerHTML = `
            <div class="control-section">
                <div class="section-header">
                    <h4>Altitude Filter</h4>
                </div>
                <div class="altitude-control">
                    <div class="altitude-display">
                        <span class="altitude-value">65,617ft (20.0km)</span>
                    </div>
                    <input type="range" id="sidebarAltitudeSlider"
                           min="0" max="20000" step="100" value="20000" class="altitude-slider">
                    <div class="range-labels">
                        <span>0ft (0m)</span>
                        <span>65,617ft (20km)</span>
                    </div>
                </div>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Display Options</h4>
                </div>
                <label class="checkbox-control">
                    <input type="checkbox" id="sidebarShowPolygons" checked>
                    <span class="checkmark"></span>
                    <span class="label-text">Show Airspace Polygons</span>
                </label>
                <label class="checkbox-control">
                    <input type="checkbox" id="sidebarShowLabels" checked>
                    <span class="checkmark"></span>
                    <span class="label-text">Show Airspace Labels</span>
                </label>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Airspace Information</h4>
                </div>
                <div class="info-placeholder">
                    <p>Click on an airspace to see detailed information</p>
                </div>
                <div class="airspace-details" id="sidebarAirspaceDetails" style="display: none;">
                    <!-- Airspace details will be populated here -->
                </div>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Airspace Classes</h4>
                    <button class="legend-toggle" id="sidebarLegendToggle">▶</button>
                </div>
                <div class="legend-content" id="sidebarLegendContent" style="display: none;">
                    ${this.generateLegendHTML()}
                </div>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Statistics</h4>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total</span>
                        <span class="stat-value" id="sidebarTotalAirspaces">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Visible</span>
                        <span class="stat-value" id="sidebarVisibleAirspaces">0</span>
                    </div>
                </div>
            </div>
        `;
  }

  createAircraftTabContent() {
    const aircraftTab = this.contentContainer.querySelector(
      '[data-tab="aircraft"]'
    );
    aircraftTab.innerHTML = `
            <div class="control-section">
                <div class="section-header">
                    <h4>Tracking Control</h4>
                </div>
                <div class="action-buttons">
                    <button id="sidebarStartTracking" class="btn primary">Start</button>
                    <button id="sidebarStopTracking" class="btn secondary" disabled>Stop</button>
                    <button id="sidebarPauseTracking" class="btn secondary" disabled>Pause</button>
                </div>

            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Data Source</h4>
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="sidebarDemoMode">
                        Demo Mode (Dummy Data)
                    </label>
                </div>
            </div>

            <div class="control-section">
                <div class="status-grid">
                    <div class="status-item">
                        <span class="status-label">Status</span>
                        <span class="status-value" id="sidebarAircraftStatus">Stopped</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">API Usage</span>
                        <span class="status-value" id="sidebarAPIRequests">0/400</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Next Update</span>
                        <span class="status-value" id="sidebarNextUpdate">--</span>
                    </div>
                </div>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Display Options</h4>
                </div>
                <label class="checkbox-control">
                    <input type="checkbox" id="sidebarShowAircraftLabels" ${
                      AircraftConfig.showLabels ? "checked" : ""
                    }>
                    <span class="checkmark"></span>
                    <span class="label-text">Show Aircraft Labels</span>
                </label>
                <label class="checkbox-control">
                    <input type="checkbox" id="sidebarShowAircraftTrails">
                    <span class="checkmark"></span>
                    <span class="label-text">Show Flight Trails</span>
                </label>
            </div>

            <div class="control-section">
                <div class="section-header">
                    <h4>Aircraft Information</h4>
                </div>
                <div class="info-placeholder">
                    <p>Click on an aircraft to see detailed information</p>
                </div>
                <div class="aircraft-details" id="sidebarAircraftDetails" style="display: none;">
                    <!-- Aircraft details will be populated here -->
                </div>
            </div>

                        <div class="control-section">
                <div class="section-header">
                    <h4>Aircraft Statistics</h4>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total</span>
                        <span class="stat-value" id="sidebarTotalAircraft">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Visible</span>
                        <span class="stat-value" id="sidebarVisibleAircraft">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">In Flight</span>
                        <span class="stat-value" id="sidebarInFlightAircraft">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">On Ground</span>
                        <span class="stat-value" id="sidebarOnGroundAircraft">0</span>
                    </div>
                </div>
            </div>
        `;
  }

  setupTabEventListeners() {
    // Setup event listeners for elements created in tab content

    // Airspace tab listeners
    const altitudeSlider = this.sidebar.querySelector("#sidebarAltitudeSlider");
    const altitudeValue = this.sidebar.querySelector(".altitude-value");
    const labelToggle = this.sidebar.querySelector("#sidebarShowLabels");
    const legendToggle = this.sidebar.querySelector("#sidebarLegendToggle");

    if (altitudeSlider && altitudeValue) {
      altitudeSlider.addEventListener("input", (e) => {
        const value = parseInt(e.target.value);
        altitudeValue.textContent = this.formatAltitudeDisplay(value);
        if (this.airspaceControls) {
          this.airspaceControls.currentAltitude = value;
        }
        if (this.airspaceVisualizer) {
          this.airspaceVisualizer.setAltitudeFilter(value);
          this.updateAirspaceStats();
        }
      });
    }

    if (labelToggle) {
      labelToggle.addEventListener("change", (e) => {
        console.log("Label toggle changed:", e.target.checked);
        console.log("Airspace visualizer:", this.airspaceVisualizer);
        console.log("Airspace controls:", this.airspaceControls);

        if (this.airspaceControls) {
          this.airspaceControls.showLabels = e.target.checked;
          console.log(
            "Updated airspace controls showLabels to:",
            e.target.checked
          );
        }
        if (this.airspaceVisualizer) {
          console.log(
            "Calling airspaceVisualizer.setShowLabels with:",
            e.target.checked
          );
          this.airspaceVisualizer.setShowLabels(e.target.checked);
        }
      });
    }

    // Polygon visibility toggle
    const polygonToggle = this.sidebar.querySelector("#sidebarShowPolygons");
    if (polygonToggle) {
      polygonToggle.addEventListener("change", (e) => {
        console.log("Polygon toggle changed:", e.target.checked);
        if (this.airspaceVisualizer) {
          this.airspaceVisualizer.setShowPolygons(e.target.checked);
        }
      });
    }

    if (legendToggle) {
      legendToggle.addEventListener("click", () => {
        this.toggleLegend();
      });
    }

    // Aircraft tab listeners
    const startBtn = this.sidebar.querySelector("#sidebarStartTracking");
    const stopBtn = this.sidebar.querySelector("#sidebarStopTracking");
    const pauseBtn = this.sidebar.querySelector("#sidebarPauseTracking");
    const testBtn = this.sidebar.querySelector("#sidebarTestAPI");

    if (startBtn && this.aircraftTracker) {
      startBtn.addEventListener("click", () => this.aircraftTracker.start());
    }
    if (stopBtn && this.aircraftTracker) {
      stopBtn.addEventListener("click", () => this.aircraftTracker.stop());
    }
    if (pauseBtn && this.aircraftTracker) {
      pauseBtn.addEventListener("click", () => {
        const stats = this.aircraftTracker.getStatistics();
        if (stats.tracking.isPaused) {
          this.aircraftTracker.resume();
          pauseBtn.textContent = "Pause";
        } else {
          this.aircraftTracker.pause();
          pauseBtn.textContent = "Resume";
        }
      });
    }
    if (testBtn && this.aircraftTracker) {
      testBtn.addEventListener("click", () =>
        this.aircraftTracker.testAPIConnection()
      );
    }

    // Aircraft display toggles
    const aircraftLabelsToggle = this.sidebar.querySelector(
      "#sidebarShowAircraftLabels"
    );
    const aircraftTrailsToggle = this.sidebar.querySelector(
      "#sidebarShowAircraftTrails"
    );

    if (
      aircraftLabelsToggle &&
      this.aircraftTracker &&
      this.aircraftTracker.visualizer
    ) {
      aircraftLabelsToggle.addEventListener("change", (e) => {
        this.aircraftTracker.visualizer.setShowLabels(e.target.checked);
      });
    }

    if (
      aircraftTrailsToggle &&
      this.aircraftTracker &&
      this.aircraftTracker.visualizer
    ) {
      aircraftTrailsToggle.addEventListener("change", (e) => {
        this.aircraftTracker.visualizer.setShowTrails(e.target.checked);
      });
    }
  }

  // Adapter methods to work with existing control systems
  setAirspaceControls(airspaceControls) {
    this.airspaceControls = airspaceControls;
    this.setupAirspaceAdapters();
    // Re-setup tab event listeners now that we have the controls
    this.setupTabEventListeners();
  }

  setAircraftControls(aircraftControls) {
    this.aircraftControls = aircraftControls;
    this.setupAircraftAdapters();
    // Re-setup tab event listeners now that we have the controls
    this.setupTabEventListeners();
  }

  setupAirspaceAdapters() {
    // Listen for airspace selection events
    if (
      this.airspaceVisualizer &&
      typeof this.airspaceVisualizer.onAirspaceClick === "function"
    ) {
      this.airspaceVisualizer.onAirspaceClick((airspace) => {
        this.showAirspaceInfo(airspace);
      });
    }

    // Update initial statistics
    this.updateAirspaceStats();
  }

  setupAircraftAdapters() {
    console.log('Setting up aircraft adapters, tracker available:', !!this.aircraftTracker);
    // Listen for aircraft events
    if (this.aircraftTracker) {
      if (typeof this.aircraftTracker.onAircraftUpdate === "function") {
        console.log('Registering aircraft update handler');
        this.aircraftTracker.onAircraftUpdate((event) => {
          console.log('Aircraft event received:', event.type, event);
          if (event.type === "data_updated") {
            this.updateAircraftStats(event.stats);
          } else if (event.type === "aircraft_selected") {
            console.log('Aircraft selected event, calling showAircraftInfo');
            this.showAircraftInfo(event.aircraft);
          }
        });
      } else {
        console.log('aircraftTracker.onAircraftUpdate is not a function');
      }

      if (typeof this.aircraftTracker.onStatusChange === "function") {
        this.aircraftTracker.onStatusChange((status) => {
          this.updateAircraftStatus(status);
        });
      }

      // Demo mode toggle handler
      const demoModeCheckbox = document.getElementById('sidebarDemoMode');
      if (demoModeCheckbox && typeof this.aircraftTracker.setDemoMode === "function") {
        demoModeCheckbox.addEventListener('change', (e) => {
          this.aircraftTracker.setDemoMode(e.target.checked);
        });
      }
    }
  }

  // Update methods
  updateAirspaceStats() {
    if (this.airspaceVisualizer) {
      const stats = this.airspaceVisualizer.getStatistics();
      const totalElement = this.sidebar.querySelector("#sidebarTotalAirspaces");
      const visibleElement = this.sidebar.querySelector(
        "#sidebarVisibleAirspaces"
      );

      if (totalElement) totalElement.textContent = stats.total;
      if (visibleElement) visibleElement.textContent = stats.visible;
    }
  }

  updateAircraftStats(stats) {
    const elements = {
      total: this.sidebar.querySelector("#sidebarTotalAircraft"),
      visible: this.sidebar.querySelector("#sidebarVisibleAircraft"),
      inFlight: this.sidebar.querySelector("#sidebarInFlightAircraft"),
      onGround: this.sidebar.querySelector("#sidebarOnGroundAircraft"),
    };

    if (elements.total) elements.total.textContent = stats.total;
    if (elements.visible) elements.visible.textContent = stats.visible;
    if (elements.inFlight) elements.inFlight.textContent = stats.inFlight;
    if (elements.onGround) elements.onGround.textContent = stats.onGround;
  }

  updateAircraftStatus(status) {
    const statusElement = this.sidebar.querySelector("#sidebarAircraftStatus");
    if (statusElement) {
      statusElement.textContent =
        status.status.charAt(0).toUpperCase() + status.status.slice(1);
      statusElement.className = `status-value ${status.status}`;
    }

    // Update button states based on tracking status
    const startBtn = this.sidebar.querySelector("#sidebarStartTracking");
    const stopBtn = this.sidebar.querySelector("#sidebarStopTracking");
    const pauseBtn = this.sidebar.querySelector("#sidebarPauseTracking");

    if (startBtn && stopBtn && pauseBtn) {
      const isRunning = status.status === "running";
      const isPaused = status.status === "paused";
      const isStopped = status.status === "stopped";

      startBtn.disabled = isRunning || isPaused;
      stopBtn.disabled = isStopped;
      pauseBtn.disabled = isStopped;
      pauseBtn.textContent = isPaused ? "Resume" : "Pause";
    }

    // Update API usage
    if (this.aircraftTracker) {
      const stats = this.aircraftTracker.getStatistics();
      const apiElement = this.sidebar.querySelector("#sidebarAPIRequests");
      const nextElement = this.sidebar.querySelector("#sidebarNextUpdate");

      if (apiElement && stats.api) {
        apiElement.textContent = `${stats.api.requestsUsed}/${stats.api.dailyLimit}`;
      }

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
  }

  showAirspaceInfo(airspace) {
    const placeholder = this.sidebar.querySelector(".info-placeholder");
    const details = this.sidebar.querySelector("#sidebarAirspaceDetails");

    if (placeholder) placeholder.style.display = "none";
    if (details) {
      details.style.display = "block";
      details.innerHTML = `
                <div class="detail-header">
                    <h5>${airspace.name}</h5>
                    <button class="close-details">✕</button>
                </div>
                <div class="detail-content">
                    <div class="detail-item">
                        <span class="detail-label">Class:</span>
                        <span class="detail-value">
                            <span class="detail-class-indicator" style="background-color: ${this.getAirspaceClassColor(
                              airspace.icaoClass
                            )}"></span>
                            ${this.getAirspaceClassDisplay(airspace.icaoClass)}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Country:</span>
                        <span class="detail-value">${airspace.country}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Lower Limit:</span>
                        <span class="detail-value altitude-hover" title="${this.formatAltitudeTooltip(
                          airspace.lowerAltitude
                        )}">${this.formatAltitudeLimit(
        airspace.lowerAltitude,
        airspace.isLowerAGL
      )}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Upper Limit:</span>
                        <span class="detail-value altitude-hover" title="${this.formatAltitudeTooltip(
                          airspace.upperAltitude
                        )}">${this.formatAltitudeLimit(
        airspace.upperAltitude,
        airspace.isUpperAGL
      )}</span>
                    </div>
                    <div class="detail-actions">
                        <button class="btn outline small" onclick="window.airspaceControls?.focusOnAirspace('${
                          airspace.id
                        }')">
                            Focus
                        </button>
                    </div>
                </div>
            `;

      // Setup close button
      const closeBtn = details.querySelector(".close-details");
      closeBtn.addEventListener("click", () => {
        details.style.display = "none";
        placeholder.style.display = "block";
      });
    }
  }

  showAircraftInfo(aircraft) {
    console.log('Showing aircraft info for:', aircraft);
    // Find the aircraft info placeholder specifically, not the airspace one
    const aircraftSection = this.sidebar.querySelector("#sidebarAircraftDetails").parentElement;
    const placeholder = aircraftSection.querySelector(".info-placeholder");
    const details = this.sidebar.querySelector("#sidebarAircraftDetails");

    if (placeholder) placeholder.style.display = "none";
    if (details) {
      details.style.display = "block";
      details.innerHTML = `
                <div class="detail-header">
                    <h5>${aircraft.callsign || aircraft.icao24 || 'Unknown'}</h5>
                    <button class="close-details">✕</button>
                </div>
                <div class="detail-content">
                    <div class="detail-item">
                        <span class="detail-label">ICAO24:</span>
                        <span class="detail-value">${aircraft.icao24 || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${
                          aircraft.aircraftType?.name || 'Unknown'
                        }</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Country:</span>
                        <span class="detail-value">${
                          aircraft.originCountry || 'Unknown'
                        }</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Altitude:</span>
                        <span class="detail-value">${aircraft.getFormattedAltitude?.() || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Speed:</span>
                        <span class="detail-value">${aircraft.getFormattedSpeed?.() || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Heading:</span>
                        <span class="detail-value">${aircraft.getFormattedHeading?.() || 'Unknown'}</span>
                    </div>
                    <div class="detail-actions">
                        <button class="btn outline small" onclick="window.aircraftControls?.focusOnAircraft('${
                          aircraft.icao24
                        }')">
                            Follow
                        </button>
                    </div>
                </div>
            `;

      // Setup close button
      const closeBtn = details.querySelector(".close-details");
      closeBtn.addEventListener("click", () => {
        details.style.display = "none";
        placeholder.style.display = "block";
      });
    }
  }

  // Legend methods
  generateLegendHTML() {
    try {
      // Use the actual AirspaceClassifier data
      const legendData = AirspaceClassifier.getLegendData();

      return legendData
        .map(
          (item) => `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${item.hexColor}"></div>
                    <div class="legend-text">
                        <div class="legend-name">${item.name}</div>
                    </div>
                </div>
            `
        )
        .join("");
    } catch (error) {
      // Fallback legend if AirspaceClassifier is not available
      console.warn(
        "AirspaceClassifier not available, using fallback legend:",
        error
      );
      const fallbackData = [
        {
          name: "Class A",
          hexColor: "#FF0000",
          description: "Controlled airspace, IFR only",
        },
        {
          name: "Class B",
          hexColor: "#FF8000",
          description: "Controlled airspace, clearance required",
        },
        {
          name: "Class C",
          hexColor: "#FFFF00",
          description: "Controlled airspace, radio contact required",
        },
        {
          name: "Class D",
          hexColor: "#0080FF",
          description: "Controlled airspace, radio contact required",
        },
        {
          name: "Class E",
          hexColor: "#8000FF",
          description: "Controlled airspace above certain altitudes",
        },
        {
          name: "Class G",
          hexColor: "#808080",
          description: "Uncontrolled airspace",
        },
        {
          name: "Restricted",
          hexColor: "#FF4444",
          description: "Restricted airspace",
        },
        {
          name: "Prohibited",
          hexColor: "#CC0000",
          description: "Prohibited airspace",
        },
        { name: "Danger", hexColor: "#FF6600", description: "Danger area" },
      ];

      return fallbackData
        .map(
          (item) => `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${item.hexColor}"></div>
                    <div class="legend-text">
                        <div class="legend-name">${item.name}</div>
                        <div class="legend-description">${item.description}</div>
                    </div>
                </div>
            `
        )
        .join("");
    }
  }

  toggleLegend() {
    const content = this.sidebar.querySelector("#sidebarLegendContent");
    const button = this.sidebar.querySelector("#sidebarLegendToggle");

    if (content && button) {
      if (content.style.display === "none") {
        content.style.display = "block";
        button.textContent = "▼";
      } else {
        content.style.display = "none";
        button.textContent = "▶";
      }
    }
  }

  // Real-time update methods
  startRealTimeUpdates() {
    // Update API usage and timing info every second
    this.realTimeUpdateTimer = setInterval(() => {
      this.updateRealTimeStats();
    }, 1000);
  }

  updateRealTimeStats() {
    if (this.aircraftTracker) {
      const stats = this.aircraftTracker.getStatistics();
      if (stats.tracking) {
        this.updateAircraftStatus({
          status: stats.tracking.isPaused
            ? "paused"
            : stats.tracking.isRunning
            ? "running"
            : "stopped",
        });
      }
    }
  }

  stopRealTimeUpdates() {
    if (this.realTimeUpdateTimer) {
      clearInterval(this.realTimeUpdateTimer);
      this.realTimeUpdateTimer = null;
    }
  }

  // Utility methods
  formatAltitudeDisplay(altitude) {
    // Convert meters to feet (1m = 3.28084ft)
    const altitudeFeet = Math.round(altitude * 3.28084);

    if (altitude >= 1000) {
      const altitudeKm = (altitude / 1000).toFixed(1);
      return `${altitudeFeet.toLocaleString()}ft (${altitudeKm}km)`;
    }
    return `${altitudeFeet.toLocaleString()}ft (${altitude}m)`;
  }

  getAirspaceClassDisplay(icaoClass) {
    // Convert numeric class to proper ICAO letter designation
    try {
      // Try to use AirspaceClassifier to get the proper class name
      const classInfo = AirspaceClassifier.getClassificationInfo(icaoClass);
      if (classInfo && classInfo.name) {
        return classInfo.name;
      }
    } catch (error) {
      console.warn(
        "AirspaceClassifier not available for class mapping:",
        error
      );
    }

    // Fallback mapping for common numeric to letter conversions
    const classMap = {
      1: "Class A",
      2: "Class B",
      3: "Class C",
      4: "Class D",
      5: "Class E",
      6: "Class F",
      7: "Class G",
      A: "Class A",
      B: "Class B",
      C: "Class C",
      D: "Class D",
      E: "Class E",
      F: "Class F",
      G: "Class G",
    };

    return classMap[icaoClass] || `Class ${icaoClass}`;
  }

  getAirspaceClassColor(icaoClass) {
    // Get the color for the airspace class indicator
    try {
      // Try to use AirspaceClassifier to get the proper class color
      const classInfo = AirspaceClassifier.getClassificationInfo(icaoClass);
      if (classInfo && classInfo.color) {
        // Convert Cesium Color to hex string
        return AirspaceClassifier.colorToHex(classInfo.color);
      }
    } catch (error) {
      console.warn(
        "AirspaceClassifier not available for color mapping:",
        error
      );
    }

    // Fallback color mapping for common classes (based on AirspaceClassifier mapping)
    const colorMap = {
      1: "#FF8C00", // Class B - Orange (255, 140, 0)
      2: "#FFFF00", // Class C - Yellow (255, 255, 0)
      3: "#00FF00", // Class D - Green (0, 255, 0)
      4: "#0000FF", // Class E - Blue (0, 0, 255)
      5: "#FF00FF", // Class F - Magenta (255, 0, 255)
      6: "#808080", // Class G - Gray (128, 128, 128)
      7: "#C8C8C8", // Unknown - Light Gray (200, 200, 200)
      8: "#FF0000", // Danger - Red (255, 0, 0)
      A: "#FF0000",
      B: "#FF8C00",
      C: "#FFFF00",
      D: "#00FF00",
      E: "#0000FF",
      F: "#FF00FF",
      G: "#808080",
    };

    return colorMap[icaoClass] || "#4CAF50"; // Default green if unknown
  }

  formatAltitudeLimit(altitude, isAGL) {
    // Format altitude limits in feet (aviation standard)
    if (altitude === null || altitude === undefined) {
      return "N/A";
    }

    // Convert meters to feet (1 meter = 3.28084 feet)
    const altitudeFeet = Math.round(altitude * 3.28084);

    // Add reference type (AGL = Above Ground Level, MSL = Mean Sea Level)
    const reference = isAGL ? "AGL" : "MSL";

    return `${altitudeFeet.toLocaleString()}ft ${reference}`;
  }

  formatAltitudeTooltip(altitude) {
    // Format tooltip with metric units
    if (altitude === null || altitude === undefined) {
      return "No altitude data available";
    }

    let metricStr;
    if (altitude >= 1000) {
      metricStr = `${(altitude / 1000).toFixed(1)}km`;
    } else {
      metricStr = `${altitude}m`;
    }

    const altitudeFeet = Math.round(altitude * 3.28084);
    return `${altitudeFeet.toLocaleString()}ft (${metricStr})`;
  }

  // Hide original controls
  hideOriginalControls() {
    const originalControls = document.querySelectorAll(".airspace-control");
    originalControls.forEach((control) => {
      control.style.display = "none";
    });
  }

  // Show original controls (for fallback)
  showOriginalControls() {
    const originalControls = document.querySelectorAll(".airspace-control");
    originalControls.forEach((control) => {
      control.style.display = "block";
    });
  }

  createWeatherTabContent() {
    if (!this.windParticleManager) {
      console.warn('[SidebarUI] WindParticleManager not provided, weather tab will be limited');
    }

    const weatherTab = this.contentContainer.querySelector('[data-tab="weather"]');
    weatherTab.innerHTML = `
      <div class="control-section">
        <div class="section-header">
          <h4>💨 Wind Visualization</h4>
        </div>

        <div class="action-buttons">
          <button class="btn primary" id="loadWindBtn">
            Load Wind Data
          </button>
          <button class="btn secondary" id="clearWindBtn">
            Clear
          </button>
        </div>

        <div id="windStatus" style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 11px; text-align: center;">
          Ready to load wind data
        </div>
      </div>

      <div class="control-section">
        <div class="section-header">
          <h4>Altitude Layers</h4>
        </div>

        <div class="checkbox-control" data-level="surface_1000hPa">
          <input type="checkbox" id="wind-surface" checked>
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(255, 255, 255); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-surface" class="label-text">Surface (100m)</label>
        </div>

        <div class="checkbox-control" data-level="pattern_925hPa">
          <input type="checkbox" id="wind-pattern" checked>
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(255, 165, 0); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-pattern" class="label-text">Pattern (750m)</label>
        </div>

        <div class="checkbox-control" data-level="low_cruise_850hPa">
          <input type="checkbox" id="wind-low" checked>
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(255, 255, 0); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-low" class="label-text">Low Cruise (1,500m)</label>
        </div>

        <div class="checkbox-control" data-level="med_cruise_700hPa">
          <input type="checkbox" id="wind-med" checked>
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(0, 255, 0); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-med" class="label-text">Med Cruise (3,000m)</label>
        </div>

        <div class="checkbox-control" data-level="high_cruise_500hPa">
          <input type="checkbox" id="wind-high" checked>
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(0, 255, 255); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-high" class="label-text">High Cruise (5,600m)</label>
        </div>

        <div class="checkbox-control" data-level="fl250_300hPa">
          <input type="checkbox" id="wind-fl250">
          <span style="display: inline-block; width: 12px; height: 12px; background: rgb(128, 0, 128); border: 1px solid #666; margin-right: 6px;"></span>
          <label for="wind-fl250" class="label-text">FL250 (9,200m)</label>
        </div>
      </div>

      <div class="control-section">
        <div class="section-header">
          <h4>Animation Speed</h4>
        </div>

        <div class="altitude-control">
          <div class="altitude-display">
            <span id="windSpeedValue" class="altitude-value">0.01x</span>
          </div>
          <input type="range" id="windSpeedSlider"
                 min="0.005" max="0.05" step="0.005" value="0.01" class="altitude-slider">
          <div class="range-labels">
            <span>Slow (0.005x)</span>
            <span>Fast (0.05x)</span>
          </div>
        </div>
      </div>
    `;

    // Setup weather tab event listeners
    this.setupWeatherEventListeners();
  }

  setupWeatherEventListeners() {
    if (!this.windParticleManager) return;

    const weatherTab = this.contentContainer.querySelector('[data-tab="weather"]');

    // Load wind button
    const loadBtn = weatherTab.querySelector('#loadWindBtn');
    loadBtn.addEventListener('click', () => this.loadWindData());

    // Clear wind button
    const clearBtn = weatherTab.querySelector('#clearWindBtn');
    clearBtn.addEventListener('click', () => this.clearWindData());

    // Layer checkboxes
    const checkboxes = weatherTab.querySelectorAll('.checkbox-control input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const levelKey = e.target.closest('.checkbox-control').dataset.level;
        this.toggleWindLayer(levelKey, e.target.checked);
      });
    });

    // Speed slider
    const speedSlider = weatherTab.querySelector('#windSpeedSlider');
    const speedValue = weatherTab.querySelector('#windSpeedValue');
    speedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      speedValue.textContent = `${speed.toFixed(3)}x`;
      // Note: Updating speed dynamically requires recreating layers
      // For now, speed is set on layer creation
    });
  }

  async loadWindData() {
    if (!this.windParticleManager) return;

    const statusDiv = document.querySelector('#windStatus');
    statusDiv.textContent = 'Loading wind data...';
    statusDiv.style.color = '#2196F3';

    try {
      await this.windParticleManager.updateWindParticles({ forceRefresh: false });

      const visibilityState = this.windParticleManager.getLayerVisibility();
      const activeCount = Object.values(visibilityState).filter(v => v).length;

      statusDiv.textContent = `✓ Wind loaded (${activeCount} layers active)`;
      statusDiv.style.color = '#4CAF50';
    } catch (error) {
      statusDiv.textContent = `✗ Error: ${error.message}`;
      statusDiv.style.color = '#f44336';
      console.error('[SidebarUI] Wind load error:', error);
    }
  }

  clearWindData() {
    if (!this.windParticleManager) return;

    this.windParticleManager.clear();

    const statusDiv = document.querySelector('#windStatus');
    statusDiv.textContent = 'Wind data cleared';
    statusDiv.style.color = '#757575';
  }

  async toggleWindLayer(levelKey, enabled) {
    if (!this.windParticleManager) return;

    try {
      await this.windParticleManager.setLayerVisibility(levelKey, enabled);

      // Update status
      const visibilityState = this.windParticleManager.getLayerVisibility();
      const activeCount = Object.values(visibilityState).filter(v => v).length;

      const statusDiv = document.querySelector('#windStatus');
      if (statusDiv && activeCount > 0) {
        statusDiv.textContent = `✓ Wind loaded (${activeCount} layers active)`;
        statusDiv.style.color = '#4CAF50';
      }
    } catch (error) {
      console.error('[SidebarUI] Layer toggle error:', error);
    }
  }

  destroy() {
    if (this.sidebar) {
      this.sidebar.remove();
    }
  }
}
