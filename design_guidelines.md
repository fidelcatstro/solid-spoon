# Design Guidelines: S2000-Style Digital Gauge Cluster

## Design Approach
**Reference-Based Approach**: Drawing inspiration from the Honda S2000 gauge cluster aesthetic - clean, performance-focused, high-contrast instrumentation with emphasis on the iconic large tachometer design. The interface prioritizes at-a-glance readability for high-performance driving scenarios.

## Core Design Principles
1. **Racing Heritage**: Clean, analog-inspired digital gauges with precise needle movements and clear numerical readouts
2. **Information Hierarchy**: Critical driving data (RPM, speed) dominate; secondary data (temps, AFR) are supporting elements
3. **Glanceable Design**: All information readable in under 1 second without focus shift
4. **Dark-Optimized Interface**: Full-screen dark theme suitable for night driving without eye strain

## Typography System

**Primary Font**: Orbitron or Rajdhani (via Google Fonts) - geometric, technical aesthetic
**Secondary Font**: Inter or Roboto - high legibility for data readouts

**Type Scale**:
- Hero Numbers (RPM/Speed): text-7xl to text-9xl (72-128px)
- Primary Gauges: text-4xl to text-6xl (36-60px)
- Secondary Data: text-xl to text-2xl (20-24px)
- Labels: text-sm to text-base (14-16px)
- Unit Indicators: text-xs (12px)

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 8, 12, 16 for consistent rhythm (p-4, gap-8, m-12)

**Grid Structure**:
- Main tachometer: Centered, occupying ~50-60% of screen width
- Speed display: Right of tachometer or integrated digitally
- Support gauges: Flanking positions or bottom third
- Warning indicators: Top bar area
- Customizable zone: Remaining space for drag-drop elements

**Component Positioning**:
```
[Warning Bar: CEL, Low Fuel, Alerts]
[Main Display Area]
├─ Large Tachometer (center-dominant)
├─ Digital Speedometer (integrated or right-side)
└─ Support Gauges Grid (coolant, fuel, AFR, MAP)
[Trip/Odometer Footer]
```

## Component Library

### Primary Gauges
**Tachometer**: 
- Circular arc gauge (220-260° sweep)
- Segmented redline zone (7000-9000 RPM S2000-style)
- Center digital RPM readout
- Animated needle with smooth interpolation (60fps)

**Speedometer**:
- Large digital display or secondary analog gauge
- Unit toggle (MPH/KM/H)
- Clear numerical readout

### Secondary Instruments
**Coolant Temperature**: Half-circle gauge, left position
**Fuel Level**: Half-circle gauge, right position  
**AFR (Air/Fuel Ratio)**: Digital bar graph or numeric display
**MAP (Manifold Pressure)**: Numeric display with bar indicator

### Data Displays
**Odometer/Trip Meters**:
- Monospaced numeric display (7-digit odometer)
- Trip A/B toggleable with reset button
- Small, unobtrusive footer placement

### Warning System
**Indicator Bar**: 
- Fixed top position (h-12 to h-16)
- Icon-based warnings with labels
- Animated pulse for active warnings
- Check engine, low fuel, high temp, custom thresholds

### Settings Panel
**Slide-out Configuration**:
- Access via gear icon (top-right corner)
- Tabbed sections: Gauges, Thresholds, Display, Connection
- Range sliders for redline, warning temps, fuel capacity
- Unit toggles and calibration inputs
- Bluetooth connection status

## Drag-and-Drop Customization

**Edit Mode Toggle**: Button activates repositioning mode
**Draggable Elements**: All gauges, data displays, indicators become draggable
**Grid Snap**: 8px or 16px snap grid for alignment
**Visual Feedback**: 
- Outline/shadow on hover
- Ghost preview during drag
- Drop zone highlights
**Save/Reset**: Quick-save layout, restore default buttons

## Animations
**Critical Constraint**: Minimal, purposeful animations only
- Gauge needle sweeps: Smooth 60fps interpolation
- Data updates: Brief fade transition (100-200ms)
- Warning indicators: Subtle pulse (avoid distraction)
- NO fancy transitions that delay information display
- NO hover effects on gauges (touch-optimized)

## Bluetooth Connection UI
**Status Indicator**: Small badge (top-left)
- Connected: Solid indicator
- Searching: Animated pulse
- Error: Warning state
**Connection Panel**: Quick-access modal for pairing, reconnecting

## Responsive Considerations
**Target Display**: 7-10" tablets (1024x600 to 1920x1080)
**Orientation**: Landscape only (lock rotation)
**Full-Screen**: Request fullscreen API on load
**Touch Targets**: Minimum 44x44px for all interactive elements

## Images
No photographic images required - this is a data visualization interface using SVG/Canvas-rendered gauges and pure UI elements.