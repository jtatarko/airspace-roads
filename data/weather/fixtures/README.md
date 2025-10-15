# Weather Test Fixtures

This directory contains test fixtures for offline development and testing of wind visualization features.

## Purpose

- **Offline Development**: Work without API dependency
- **Consistent Testing**: Reproducible scenarios for debugging
- **Multiple Scenarios**: Test various weather conditions
- **Fast Iteration**: Instant load times vs API delays

## Available Fixtures

### slovenia-wind-sample-1.json
**Calm Winds - Spring**
- Light westerly winds (8-25 km/h)
- Clear spring conditions
- Perfect for VFR operations
- Use for: Baseline testing, pattern work visualization

### slovenia-wind-sample-2.json
**Moderate Winds - Summer**
- Moderate winds (15-65 km/h)
- Summer conditions with thermal activity
- Good wind gradient across altitudes
- Use for: Cross-country flight planning, wind shear visualization

### slovenia-wind-storm.json
**Storm Conditions - Winter**
- Severe winds (45-185 km/h)
- Winter storm with jet stream
- Extreme conditions at all levels
- Use for: Stress testing, extreme weather visualization, jet stream display

## Fixture Format

Each fixture contains:
```json
{
  "fixture_metadata": {
    "name": "...",
    "description": "...",
    "scenario": "calm|moderate|storm",
    "season": "spring|summer|autumn|winter"
  },
  "location": { ... },
  "timestamp": "ISO8601",
  "wind_data": {
    "surface_1000hPa": { windspeed_kmh, winddirection_deg, ... },
    "pattern_925hPa": { ... },
    "low_cruise_850hPa": { ... },
    "med_cruise_700hPa": { ... },
    "high_cruise_500hPa": { ... },
    "fl250_300hPa": { ... }
  },
  "precipitation": { ... }
}
```

## Usage

### In Code
```javascript
import { WeatherDataManager } from './weather-data-manager.js';

const dataManager = new WeatherDataManager();

// Load specific fixture
const data = await dataManager.loadFixture('slovenia-wind-sample-1.json');

// Or use getWindData with option
const data = await dataManager.getWindData({
  useFixture: 'slovenia-wind-storm.json'
});
```

### Creating New Fixtures

#### Method 1: Export from Live API
```javascript
// In browser console
const dataManager = new WeatherDataManager();
await dataManager.getWindData();  // Fetch live data
dataManager.exportAsFixture('Custom Scenario', 'Description here');
// Downloads JSON file - move to this directory
```

#### Method 2: Manual Creation
1. Copy an existing fixture
2. Modify wind speeds, directions, temperatures
3. Update metadata (name, description, scenario)
4. Add entry to `metadata.json`

## Wind Data Guidelines

### Realistic Wind Patterns
- **Surface (1000 hPa)**: Typically 0-40 km/h, affected by terrain
- **Pattern (925 hPa)**: Usually 5-50 km/h, critical for pattern ops
- **Low Cruise (850 hPa)**: 10-70 km/h, most used altitude
- **Medium Cruise (700 hPa)**: 20-90 km/h, cross-country level
- **High Cruise (500 hPa)**: 40-130 km/h, near jet stream
- **FL250 (300 hPa)**: 80-200 km/h, jet stream core

### Wind Direction
- Meteorological convention: Direction wind is **from** (0° = North)
- Typically veers (clockwise) with altitude in Northern Hemisphere
- Example: Surface 270° (W) → FL250 245° (WSW)

### Temperature
- Standard atmosphere: -6.5°C per 1000m
- Surface: -20°C to +40°C (seasonal)
- FL250: Typically -40°C to -60°C

## Version Control

- ✅ **Committed**: All `.json` fixtures (for testing)
- ❌ **Ignored**: `../cache/` directory (runtime only)

## Updating Fixtures

When updating fixtures:
1. Modify fixture JSON file
2. Update `metadata.json` if needed
3. Update `last_updated` timestamp
4. Commit changes to git

## See Also

- [WeatherDataManager](../../../weather-data-manager.js) - Data loading and caching
- [WindArrowManager](../../../wind-arrow-manager.js) - Wind visualization
