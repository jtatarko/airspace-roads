import { Color } from "cesium";

export class AirspaceClassifier {
  static ICAO_CLASS_COLORS = {
    1: {
      name: "Class B",
      color: Color.fromBytes(255, 140, 0, 255),
      description: "Terminal radar service area",
    }, // Orange
    2: {
      name: "Class C",
      color: Color.fromBytes(255, 255, 0, 255),
      description: "Terminal radar service",
    }, // Yellow
    3: {
      name: "Class D",
      color: Color.fromBytes(0, 255, 0, 255),
      description: "Airport traffic area",
    }, // Green
    4: {
      name: "Class E",
      color: Color.fromBytes(0, 0, 255, 255),
      description: "Controlled airspace",
    }, // Blue
    5: {
      name: "Class F",
      color: Color.fromBytes(255, 0, 255, 255),
      description: "Advisory airspace",
    }, // Magenta
    6: {
      name: "Class G",
      color: Color.fromBytes(128, 128, 128, 255),
      description: "Uncontrolled airspace",
    }, // Gray
    7: {
      name: "Unknown",
      color: Color.fromBytes(200, 200, 200, 255),
      description: "Unknown airspace classification",
    }, // Light Gray
    8: {
      name: "Danger",
      color: Color.fromBytes(255, 0, 0, 255),
      description: "Danger area",
    }, // Red
  };

  static AIRSPACE_TYPES = {
    1: { name: "FIR", pattern: "solid" },
    2: { name: "UIR", pattern: "solid" },
    3: { name: "TMA", pattern: "solid" },
    4: { name: "CTR", pattern: "solid" },
    5: { name: "RESTRICTED", pattern: "striped" },
    6: { name: "PROHIBITED", pattern: "striped" },
    7: { name: "CTA", pattern: "solid" },
    8: { name: "MILITARY", pattern: "striped" },
  };

  static getClassificationInfo(icaoClass) {
    return this.ICAO_CLASS_COLORS[icaoClass] || this.ICAO_CLASS_COLORS[6];
  }

  static getTypeInfo(type) {
    return this.AIRSPACE_TYPES[type] || { name: "UNKNOWN", pattern: "solid" };
  }

  static getAirspaceColor(airspace, options = {}) {
    const { opacity = 0.5, highlighted = false } = options;
    const classification = this.getClassificationInfo(airspace.icaoClass);
    const color = classification.color.clone();

    if (highlighted) {
      color.alpha = Math.min(1.0, opacity + 0.5);
    } else {
      color.alpha = opacity;
    }

    return color;
  }

  static getOutlineColor(airspace, options = {}) {
    const { opacity = 0.8, highlighted = false } = options;
    const color = Color.WHITE.clone();

    if (highlighted) {
      color.alpha = 0.5;
    } else {
      color.alpha = opacity;
    }

    return color;
  }

  static shouldUsePattern(airspace) {
    const typeInfo = this.getTypeInfo(airspace.type);
    return typeInfo.pattern === "striped";
  }

  static getVisualizationStyle(airspace, options = {}) {
    const { highlighted = false, showLabels = true } = options;
    const classification = this.getClassificationInfo(airspace.icaoClass);
    const typeInfo = this.getTypeInfo(airspace.type);

    return {
      fill: true,
      fillColor: this.getAirspaceColor(airspace, { highlighted, opacity: 0.1 }),
      outline: true,
      outlineColor: this.getOutlineColor(airspace, {
        highlighted,
        opacity: 0.1,
      }),
      outlineWidth: highlighted ? 3 : 1,
      showLabel: showLabels,
      labelText: airspace.name,
      labelStyle: {
        font: "12pt sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: "FILL_AND_OUTLINE",
        pixelOffset: { x: 0, y: -30 },
      },
      classification: classification.name,
      type: typeInfo.name,
      pattern: typeInfo.pattern,
    };
  }

  static getLegendData() {
    return Object.entries(this.ICAO_CLASS_COLORS).map(([classNum, info]) => ({
      class: classNum,
      name: info.name,
      color: info.color,
      description: info.description,
      hexColor: this.colorToHex(info.color),
    }));
  }

  static colorToHex(color) {
    const r = Math.round(color.red * 255)
      .toString(16)
      .padStart(2, "0");
    const g = Math.round(color.green * 255)
      .toString(16)
      .padStart(2, "0");
    const b = Math.round(color.blue * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  static filterByAltitude(airspaces, maxAltitude) {
    return airspaces.filter(
      (airspace) => airspace.lowerAltitude <= maxAltitude
    );
  }

  static groupByClassification(airspaces) {
    const groups = {};

    airspaces.forEach((airspace) => {
      const classification = this.getClassificationInfo(airspace.icaoClass);
      const key = classification.name;

      if (!groups[key]) {
        groups[key] = {
          classification: classification,
          airspaces: [],
        };
      }

      groups[key].airspaces.push(airspace);
    });

    return groups;
  }
}
