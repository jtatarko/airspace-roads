// aircraft-icon-manager.js
// SVG icon management system for aircraft types

import { AircraftCategories } from "./aircraft-types.js";

/**
 * Manages loading, caching, and rendering of aircraft SVG icons
 */
export class AircraftIconManager {
  constructor() {
    // Cache for loaded SVG strings
    this.svgCache = new Map();
    // Cache for rendered icon data URLs with colors
    this.iconCache = new Map();

    // Base path for aircraft icons
    this.basePath = "./assets/icons/aircraft/";

    // Icon mapping from category ID to filename
    this.iconFiles = {
      commercial: "commercial.svg",
      general: "general.svg",
      helicopter: "helicopter.svg",
      light: "light.svg",
      military: "military.svg",
      unknown: "unknown.svg",
    };

    console.log("Aircraft Icon Manager initialized");
  }

  /**
   * Load all aircraft SVG icons
   */
  async loadAllIcons() {
    const loadPromises = Object.keys(this.iconFiles).map((categoryId) =>
      this.loadSVG(categoryId)
    );

    try {
      await Promise.all(loadPromises);
      console.log("All aircraft icons loaded successfully");
      return true;
    } catch (error) {
      console.error("Error loading aircraft icons:", error);
      return false;
    }
  }

  /**
   * Load a single SVG file
   */
  async loadSVG(categoryId) {
    if (this.svgCache.has(categoryId)) {
      return this.svgCache.get(categoryId);
    }

    const filename = this.iconFiles[categoryId];
    if (!filename) {
      console.warn(`No icon file defined for category: ${categoryId}`);
      return this.getFallbackSVG();
    }

    try {
      const response = await fetch(this.basePath + filename);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const svgText = await response.text();
      this.svgCache.set(categoryId, svgText);
      console.log(`Loaded SVG icon: ${filename}`);
      return svgText;
    } catch (error) {
      console.error(`Failed to load SVG icon ${filename}:`, error);
      const fallback = this.getFallbackSVG();
      this.svgCache.set(categoryId, fallback);
      return fallback;
    }
  }

  /**
   * Get fallback SVG for missing icons
   */
  getFallbackSVG() {
    return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" fill="currentColor" stroke="white" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" font-family="Arial" font-size="14" fill="white">?</text>
        </svg>`;
  }

  /**
   * Get aircraft icon as data URL with specific color
   */
  async getAircraftIcon(aircraft, options = {}) {
    const categoryId = aircraft.aircraftType?.id || "unknown";
    const color = options.color || aircraft.aircraftType?.color || "#95A5A6";
    const size = options.size || 32;
    const rotation = options.rotation || aircraft.trueTrack || 0;

    // Create cache key
    const cacheKey = `${categoryId}_${color}_${size}_${Math.round(rotation)}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey);
    }

    // Load SVG if not cached
    const svgText = await this.loadSVG(categoryId);

    // Create colored and rotated version
    const iconDataUrl = this.createIconDataUrl(svgText, color, size, rotation);

    // Cache the result
    this.iconCache.set(cacheKey, iconDataUrl);

    return iconDataUrl;
  }

  /**
   * Create a data URL from SVG with color and rotation
   */
  createIconDataUrl(svgText, color, size, rotation) {
    // Parse and modify the SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = svgDoc.documentElement;

    // Get original viewBox or dimensions to maintain aspect ratio
    const originalViewBox = svgElement.getAttribute("viewBox");
    const originalWidth = svgElement.getAttribute("width");
    const originalHeight = svgElement.getAttribute("height");

    // Use original viewBox if available, otherwise create from dimensions
    if (!originalViewBox && originalWidth && originalHeight) {
      svgElement.setAttribute(
        "viewBox",
        `0 0 ${originalWidth} ${originalHeight}`
      );
    }

    // Set final size (maintaining 1:1 aspect ratio)
    svgElement.setAttribute("width", size);
    svgElement.setAttribute("height", size);

    // Apply color to fill elements
    const fillElements = svgElement.querySelectorAll(
      '[fill="black"], path:not([fill])'
    );
    fillElements.forEach((element) => {
      element.setAttribute("fill", color);
    });

    // Apply rotation transform
    if (rotation !== 0) {
      const group = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");

      // Calculate center point from viewBox
      const viewBox = svgElement.getAttribute("viewBox");
      let centerX = 40,
        centerY = 40; // Default center for 80x80

      if (viewBox) {
        const [, , width, height] = viewBox.split(" ").map(Number);
        centerX = width / 2;
        centerY = height / 2;
      }

      group.setAttribute(
        "transform",
        `rotate(${rotation} ${centerX} ${centerY})`
      );

      // Move all children to the group
      while (svgElement.firstChild) {
        group.appendChild(svgElement.firstChild);
      }
      svgElement.appendChild(group);
    }

    // Serialize back to string
    const serializer = new XMLSerializer();
    const modifiedSvg = serializer.serializeToString(svgElement);

    // Create data URL
    const encodedSvg = encodeURIComponent(modifiedSvg);
    return `data:image/svg+xml,${encodedSvg}`;
  }

  /**
   * Preload icons for better performance
   */
  async preloadIcons() {
    console.log("Preloading aircraft icons...");

    const loadPromises = [];

    // Load base icons for each category
    Object.values(AircraftCategories).forEach((category) => {
      if (category.id !== "unknown") {
        loadPromises.push(
          this.getAircraftIcon(
            { aircraftType: category, trueTrack: 0 },
            { color: category.color, size: 80 }
          )
        );
      }
    });

    try {
      await Promise.all(loadPromises);
      console.log("Aircraft icons preloaded successfully");
    } catch (error) {
      console.error("Error preloading aircraft icons:", error);
    }
  }

  /**
   * Clear icon cache (useful for memory management)
   */
  clearCache() {
    this.iconCache.clear();
    console.log("Aircraft icon cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      svgCacheSize: this.svgCache.size,
      iconCacheSize: this.iconCache.size,
      loadedCategories: Array.from(this.svgCache.keys()),
    };
  }
}

// Create singleton instance
export const aircraftIconManager = new AircraftIconManager();
