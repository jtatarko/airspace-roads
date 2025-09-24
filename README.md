# Airspace Roads - 3D Aviation Visualization System

An interactive 3D airspace visualization system with real-time aircraft tracking, built with Cesium.js for immersive aviation data exploration.

## Features

### 🌍 3D Airspace Visualization
- Interactive 3D airspace zone rendering (Slovenia region)
- Altitude-based filtering with dynamic color coding
- Click-to-inspect detailed airspace information and boundaries
- Real-time elevation data display

### ✈️ Real-time Aircraft Tracking
- Live aircraft data from OpenSky Network API
- Color-coded aircraft types:
  - **Commercial Airliner** (Red): A320, B737, B777, etc.
  - **General Aviation** (Teal): C172, PA28, private aircraft
  - **Helicopter** (Blue): R44, emergency services, etc.
  - **Light Aircraft** (Green): Gliders, ultralights
- Flight trails with configurable history
- 30-second update intervals
- Detailed aircraft information panels

### 🎛️ Unified Sidebar Interface
- Tabbed navigation (Airspace, Aircraft, Info)
- Real-time statistics and status monitoring
- Advanced filtering and search capabilities
- Responsive design with collapsible sidebar

### 🚨 Airspace Violation Detection
- Real-time monitoring of aircraft positions vs airspace boundaries
- Alert system for potential violations
- Integration with aircraft tracking system

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **3D Engine**: Cesium.js with terrain support
- **Build Tool**: Vite
- **APIs**: OpenSky Network for real-time aircraft data
- **Data Format**: GeoJSON for airspace definitions

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd airspace-roads
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up Cesium Ion token:
   - Create a `.env` file in the root directory
   - Add your Cesium Ion token: `VITE_CESIUM_ION_TOKEN=your_token_here`

### Development

Start the development server:
```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`

## Usage

### Basic Airspace Exploration
1. Use the altitude slider to filter airspace zones by height
2. Click on airspace zones to view detailed information
3. Toggle airspace labels for better visibility

### Aircraft Tracking
1. Open the sidebar and navigate to the Aircraft tab
2. Click "Start Tracking" to begin real-time aircraft data fetching
3. Use filters to show/hide specific aircraft types
4. Click on aircraft icons for detailed flight information

### Advanced Features
- Search for specific aircraft by callsign or registration
- Monitor API usage statistics and rate limits
- Export aircraft data for analysis

## Project Structure

```
├── main.js                           # Application entry point
├── index.html                        # Main HTML template
├── package.json                      # Dependencies and scripts
├── vite.config.js                    # Vite configuration
├── data/                             # Airspace GeoJSON data
├── airspace-visualizer.js            # 3D airspace rendering
├── airspace-classifier.js            # Airspace categorization
├── aircraft-tracker.js               # Real-time aircraft data management
├── aircraft-api-service.js           # OpenSky API integration
├── aircraft-classifier.js            # Aircraft type classification
├── aircraft-visualizer.js            # 3D aircraft rendering
├── airspace-violation-detector.js    # Violation detection logic
├── sidebar-ui-controls.js            # Unified sidebar interface
├── ui-controls.js                    # Legacy airspace controls
├── aircraft-ui-controls.js           # Legacy aircraft controls
├── data-processor.js                 # Data transformation utilities
├── aircraft-types.js                 # Aircraft classification data
└── test-*.html                       # Individual component tests
```

## API Integration

### OpenSky Network
- **Anonymous Access**: 400 requests per day
- **Rate Limiting**: Automatic throttling and usage tracking
- **Coverage**: Configurable geographic regions
- **Authentication**: Optional OAuth2 for enhanced limits

### Configuration
The application automatically handles API rate limiting and displays usage statistics in the sidebar.

## Development

### Core Modules
- **AirspaceVisualizer**: Handles 3D airspace zone rendering and interaction
- **AircraftTracker**: Manages real-time aircraft data fetching and state
- **SidebarUIControls**: Unified interface for all controls and information
- **ViolationDetector**: Monitors aircraft positions against airspace boundaries

### Testing
Individual component tests are available:
- `test-airspace-classification.html` - Airspace classification testing
- `test-aircraft.html` - Aircraft tracking functionality
- `test-data-models.html` - Data model validation

### Adding Features
1. Follow existing module patterns for new functionality
2. Integrate with the unified sidebar interface
3. Update relevant test files
4. Consider performance impact on 3D rendering

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow existing code style and patterns
4. Test your changes thoroughly
5. Submit a pull request with detailed description

## License

ISC

## Documentation

For detailed implementation guides, see:
- `AIRCRAFT_TRACKING_GUIDE.md` - Comprehensive aircraft tracking usage
- `realtime_aircraft_spec.md` - Technical specifications and requirements