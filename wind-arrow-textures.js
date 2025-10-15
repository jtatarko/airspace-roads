/**
 * Wind Arrow Texture Generator
 *
 * Creates arrow textures for wind visualization at different altitude levels.
 * Each arrow is color-coded by altitude and sized appropriately.
 */

import * as Cesium from 'cesium';

/**
 * Level color definitions (color by altitude)
 */
export const LEVEL_COLORS = {
  surface_1000hPa: Cesium.Color.WHITE,
  pattern_925hPa: Cesium.Color.ORANGE,
  low_cruise_850hPa: Cesium.Color.YELLOW,
  med_cruise_700hPa: Cesium.Color.LIME,
  high_cruise_500hPa: Cesium.Color.CYAN,
  fl250_300hPa: Cesium.Color.PURPLE
};

/**
 * Level display names
 */
export const LEVEL_NAMES = {
  surface_1000hPa: 'Surface (100m)',
  pattern_925hPa: 'Pattern (2,500 ft)',
  low_cruise_850hPa: 'Low Cruise (5,000 ft)',
  med_cruise_700hPa: 'Medium Cruise (10,000 ft)',
  high_cruise_500hPa: 'High Cruise (18,000 ft)',
  fl250_300hPa: 'FL250 (30,000 ft)'
};

/**
 * Texture cache to avoid regenerating
 */
const textureCache = new Map();

/**
 * Create arrow texture with specified color and size
 * @param {Cesium.Color} color - Arrow color
 * @param {number} size - Texture size in pixels (12, 16, or 20)
 * @returns {HTMLCanvasElement} Canvas with arrow texture
 */
export function createArrowTexture(color, size = 16) {
  const cacheKey = `${color.toCssColorString()}_${size}`;

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Clear background (transparent)
  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const arrowLength = size * 0.7;
  const arrowWidth = size * 0.35;
  const shaftWidth = size * 0.15;

  // Draw arrow pointing RIGHT (0° reference, will be rotated by billboard)
  ctx.beginPath();

  // Start at tail (left)
  ctx.moveTo(centerX - arrowLength / 2, centerY - shaftWidth / 2);

  // Shaft top
  ctx.lineTo(centerX + arrowLength / 5, centerY - shaftWidth / 2);

  // Top fin
  ctx.lineTo(centerX + arrowLength / 5, centerY - arrowWidth / 2);

  // Arrow tip
  ctx.lineTo(centerX + arrowLength / 2, centerY);

  // Bottom fin
  ctx.lineTo(centerX + arrowLength / 5, centerY + arrowWidth / 2);

  // Shaft bottom
  ctx.lineTo(centerX + arrowLength / 5, centerY + shaftWidth / 2);

  // Back to tail
  ctx.lineTo(centerX - arrowLength / 2, centerY + shaftWidth / 2);

  ctx.closePath();

  // Draw outline (white for contrast)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(1, size / 16);
  ctx.stroke();

  // Fill with level color
  ctx.fillStyle = color.toCssColorString();
  ctx.globalAlpha = 0.85;
  ctx.fill();

  // Add subtle glow for high wind speeds (optional, can be enhanced later)
  ctx.globalAlpha = 0.3;
  ctx.shadowColor = color.toCssColorString();
  ctx.shadowBlur = size / 8;
  ctx.fill();

  textureCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Get arrow texture for specific level
 * @param {string} levelKey - Level key (e.g., 'low_cruise_850hPa')
 * @param {number} size - Optional size override
 * @returns {HTMLCanvasElement} Arrow texture
 */
export function getArrowTextureForLevel(levelKey, size = null) {
  const color = LEVEL_COLORS[levelKey] || Cesium.Color.WHITE;

  // Default sizes based on level
  if (!size) {
    if (levelKey === 'fl250_300hPa') {
      size = 12;  // Smaller for high altitude
    } else if (levelKey === 'pattern_925hPa') {
      size = 20;  // Larger for pattern (most important)
    } else {
      size = 16;  // Medium for others
    }
  }

  return createArrowTexture(color, size);
}

/**
 * Pre-generate all arrow textures at startup
 * Call this once during initialization for better performance
 * @returns {Object} Map of level keys to textures
 */
export function preloadAllArrowTextures() {
  const textures = {};

  Object.keys(LEVEL_COLORS).forEach(levelKey => {
    textures[levelKey] = getArrowTextureForLevel(levelKey);
  });

  console.log('[WindArrowTextures] Preloaded', Object.keys(textures).length, 'arrow textures');
  return textures;
}

/**
 * Calculate arrow scale based on wind speed
 * Stronger winds = larger arrows for visibility
 * @param {number} windSpeedKmh - Wind speed in km/h
 * @returns {number} Scale factor (0.5 to 2.0)
 */
export function calculateArrowScaleForWindSpeed(windSpeedKmh) {
  if (windSpeedKmh < 10) return 0.6;   // Calm - small
  if (windSpeedKmh < 20) return 0.8;   // Light - slightly small
  if (windSpeedKmh < 40) return 1.0;   // Moderate - normal
  if (windSpeedKmh < 60) return 1.3;   // Strong - larger
  if (windSpeedKmh < 100) return 1.6;  // Very strong - much larger
  return 2.0;                          // Extreme - largest
}

/**
 * Get color for wind speed (alternative coloring mode)
 * Not used by default (we color by altitude), but available for UI option
 * @param {number} windSpeedKmh - Wind speed in km/h
 * @returns {Cesium.Color} Color representing wind speed
 */
export function getColorForWindSpeed(windSpeedKmh) {
  if (windSpeedKmh < 10) return Cesium.Color.LIGHTBLUE;
  if (windSpeedKmh < 20) return Cesium.Color.CYAN;
  if (windSpeedKmh < 30) return Cesium.Color.LIME;
  if (windSpeedKmh < 40) return Cesium.Color.YELLOW;
  if (windSpeedKmh < 60) return Cesium.Color.ORANGE;
  if (windSpeedKmh < 100) return Cesium.Color.RED;
  return Cesium.Color.MAGENTA;  // Extreme (jet stream)
}

/**
 * Clear texture cache (useful for memory management)
 */
export function clearTextureCache() {
  textureCache.clear();
  console.log('[WindArrowTextures] Texture cache cleared');
}

/**
 * Get cardinal direction from degrees
 * @param {number} degrees - Wind direction in degrees (0-360)
 * @returns {string} Cardinal direction (N, NE, E, etc.)
 */
export function getCardinalDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) / 22.5)) % 16;
  return directions[index];
}

/**
 * Create simple dot texture (fallback if arrows don't perform well)
 * @param {Cesium.Color} color - Dot color
 * @param {number} size - Dot size
 * @returns {HTMLCanvasElement} Canvas with dot texture
 */
export function createDotTexture(color, size = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 1;

  // Draw filled circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = color.toCssColorString();
  ctx.globalAlpha = 0.8;
  ctx.fill();

  // Subtle outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas;
}
