# Aircraft Tracking System Guide

This guide explains how to use the real-time aircraft tracking features that have been integrated into the airspace visualization application.

## Quick Start

1. **Open the Application**: Navigate to `http://localhost:5173/` in your browser
2. **Start Aircraft Tracking**: Click the "Start Tracking" button in the Aircraft Tracking panel
3. **View Aircraft**: Real-time aircraft will appear as colored icons on the 3D map
4. **Interact**: Click on aircraft to see detailed information

## Features Overview

### 📡 Real-time Aircraft Data
- **Data Source**: OpenSky Network API
- **Update Frequency**: Every 30 seconds
- **Coverage**: Slovenia region (expandable to custom areas)
- **Rate Limiting**: 400 requests/day (anonymous), displays usage stats

### ✈️ Aircraft Visualization
- **Color-coded Icons**: Different colors for aircraft types
- **Flight Trails**: Optional display of recent flight paths
- **3D Positioning**: Accurate altitude representation
- **Labels**: Configurable callsign and altitude display

### 🔍 Aircraft Categories
- **Commercial Airliner** (Red): A320, B737, B777, etc.
- **General Aviation** (Teal): C172, PA28, private aircraft
- **Helicopter** (Blue): R44, emergency services, etc.
- **Light Aircraft** (Green): Gliders, ultralights
- **Military/Government** (Yellow): Military and official aircraft
- **Unknown** (Gray): Unclassified aircraft

### 🎛️ Controls & Filters

#### Aircraft Tracking Panel
- **Start/Stop/Pause**: Control aircraft data updates
- **Show Labels**: Toggle aircraft callsign/altitude labels
- **Show Trails**: Toggle flight path visualization
- **Tracking Region**: Select area (Slovenia, Custom, Global)

#### Aircraft Filters Panel
- **Aircraft Types**: Show/hide specific aircraft categories
- **Altitude Range**: Filter by flight altitude (feet)
- **Speed Range**: Filter by ground speed (knots)
- **Active Only**: Show only recently updated aircraft
- **Search**: Find aircraft by callsign or ICAO24 code

#### Status Panel
- **Connection Status**: Live API connection status
- **API Usage**: Request count and daily limit
- **Next Update**: Countdown to next data refresh
- **Error Display**: Shows any connection issues

#### Statistics Panel
- **Aircraft Counts**: Total, visible, in-flight, on-ground
- **Performance**: Average altitude and speed
- **Real-time Updates**: Live statistics

### 🚨 Airspace Violation Detection

The system automatically detects when aircraft enter restricted airspace:

- **Real-time Monitoring**: Continuous checking during updates
- **Visual Alerts**: Highlighted aircraft and airspace zones
- **Browser Notifications**: Popup alerts for critical violations
- **Violation Types**: Prohibited areas, danger zones, military airspace

### 🖱️ Interaction Features

#### Click on Aircraft
- **Aircraft Info Panel**: Detailed aircraft information
- **Follow Aircraft**: Camera tracking of selected aircraft
- **Technical Data**: Position, speed, heading, status

#### Aircraft Information Includes:
- Callsign and registration
- Aircraft type and category
- Current position (lat/lon/altitude)
- Flight data (speed, heading, status)
- Contact information (last seen, update count)
- Transponder code (if available)

## Usage Tips

### 💡 Best Practices
1. **Start Small**: Begin with Slovenia region to conserve API requests
2. **Monitor Usage**: Keep an eye on the API request counter
3. **Use Filters**: Hide unnecessary aircraft types to improve performance
4. **Check Violations**: Monitor the violation alerts for safety awareness

### ⚠️ Rate Limiting
- **Anonymous Users**: 400 requests per day
- **Request Timer**: 30-second minimum between requests
- **Usage Display**: Real-time counter in status panel
- **Reset Time**: Daily counter resets at midnight

### 🎯 Performance Tips
- **LOD System**: Aircraft detail automatically reduces at distance
- **Filter Aircraft**: Use type and altitude filters to reduce visual clutter
- **Pause Tracking**: Pause updates when not actively monitoring
- **Trail Management**: Disable trails if performance is poor

## Technical Details

### 🏗️ Architecture
- **Modular Design**: Separate components for API, visualization, and UI
- **Event-driven**: Real-time updates and user interactions
- **Performance Optimized**: LOD, culling, and efficient rendering
- **Error Resilient**: Graceful degradation and retry mechanisms

### 📊 Data Processing
- **Classification**: Automatic aircraft type detection
- **Position Interpolation**: Smooth movement between updates
- **Trail Management**: Limited to 20 positions per aircraft
- **Violation Detection**: Point-in-polygon testing for airspace

### 🔧 Configuration
Default settings can be found in `aircraft-types.js`:
- Update interval: 30 seconds
- Maximum aircraft: 100
- Trail length: 20 positions
- LOD distances: 100km/500km

## Troubleshooting

### Common Issues

#### No Aircraft Appearing
1. Check API connection status in status panel
2. Verify internet connection
3. Check if daily API limit has been reached
4. Try pausing and restarting tracking

#### Performance Issues
1. Reduce number of visible aircraft with filters
2. Disable flight trails
3. Lower altitude range filter
4. Hide aircraft labels

#### API Errors
1. Check internet connection
2. Wait for rate limit cooldown
3. Try different tracking region
4. Check browser console for detailed errors

### Error Messages
- **Rate Limit**: Wait for countdown timer to reach zero
- **Connection Failed**: Check internet and try again
- **Daily Limit Reached**: Wait until midnight for reset
- **Invalid Region**: Check custom bounds configuration

## Advanced Features

### 🔧 Custom Regions
You can modify the tracking region by:
1. Selecting "Custom Area" in the region dropdown
2. Configuring bounds in the aircraft tracker
3. Using latitude/longitude coordinates

### 📱 Mobile Support
- Responsive design adapts to tablet screens
- Touch-friendly controls
- Vertical layout on smaller screens

### 🌐 Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Basic support

## API Reference

For developers wanting to extend the system:

### Key Classes
- `AircraftTracker`: Main tracking manager
- `AircraftVisualizer`: Cesium visualization
- `AircraftAPIService`: OpenSky API integration
- `AircraftClassifier`: Type detection and styling
- `AirspaceViolationDetector`: Violation monitoring

### Events
- `onAircraftUpdate`: Aircraft data updates
- `onViolationDetected`: Airspace violations
- `onStatusChange`: System status changes
- `onError`: Error conditions

## Support

### Testing Page
Visit `/test-aircraft.html` to run system tests and verify functionality.

### Console Logging
The system provides detailed console logging for debugging:
- Aircraft updates and classifications
- API requests and responses
- Violation detections
- Performance metrics

### Contributing
The aircraft tracking system is built with a modular architecture that makes it easy to extend and customize for specific needs.