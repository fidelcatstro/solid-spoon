# S2000 Digital Gauge Cluster

## Overview

The S2000 Digital Gauge Cluster is a real-time application for Honda S2000 vehicles with Hondata KPro ECU integration. It displays telemetry data (RPM, speed, temperatures, fuel levels, AFR, MAP) through a racing-inspired, dark-themed interface mirroring the S2000 instrument cluster.

Key features include WebSocket-based real-time data streaming, customizable gauge layouts, configurable warning thresholds, multi-page navigation (Home, Gauges, Quarter Mile, Diagnostics, Debug, Settings), and Bluetooth/USB connectivity for KPro ECU integration. The project aims to provide a comprehensive and intuitive digital display solution for S2000 enthusiasts, enhancing the driving experience with modern telemetry and diagnostic capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: Custom React hooks with localStorage persistence
- **Styling**: Tailwind CSS with custom CSS variables, Shadcn/ui component library
- **Data Fetching**: TanStack Query
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **Real-time Communication**: WebSocket server (ws library) for live telemetry streaming
- **API Pattern**: RESTful endpoints with WebSocket for real-time data
- **Storage**: In-memory storage, designed for future database migration

### Data Flow
The system supports multiple data sources:
1.  **Bluetooth Connection**: Web Bluetooth API for direct ECU communication (Chrome/Chromium only).
2.  **Browser USB Connection**: Web Serial API for direct ECU communication (Chrome/Chromium only).
3.  **Server USB Connection**: WebSocket receives ECU data from a server-side serial port (browser agnostic).
4.  **Demo Mode**: WebSocket provides simulated telemetry data as a fallback.
Gauges remain frozen with "Awaiting ECU Connection" until an active data source is established. Browser capabilities dictate available connection options. Telemetry data updates all connected gauge components in real-time, with client-side state managing updates and settings persistence.

### Bluetooth Integration
Utilizes Web Bluetooth API for direct device communication, supporting KPro V4 specific BLE services and ELM327 protocol for OBD-II PID requests. It handles device discovery, connection states, and polls telemetry channels at approximately 11Hz per PID.

### Key Design Patterns
- **Component Composition**: Modular and reusable UI components.
- **Draggable Layout System**: Grid-based positioning for customizable gauge arrangements.
- **Theme System**: CSS custom properties for a consistent dark racing theme.
- **Storage Abstraction**: `IStorage` interface for flexible data persistence.

### UI/UX Decisions
The application features a dark, racing-inspired theme. Key UI components include:
-   **AppLayout**: Main layout with a collapsible sidebar, including a debug error badge.
-   **Multi-Page Navigation**: Home, Gauges, Quarter Mile, Diagnostics, Debug, and Settings pages.
-   **Dashboard**: Features a GaugeCluster page with individual gauge components (Tachometer, Speedometer, AFRGauge).
-   **Diagnostics Page**: Live sensor grid with expandable real-time graphs and an offline DTC Code Database for troubleshooting.
-   **Debug Page**: Provides a live rolling feed of server and client events with timestamps and level badges, offering a "Copy Report" feature for diagnostics.
-   **Color Theming**: 6 preset color schemes with per-gauge customization, with fixed red (7000+ RPM) and yellow (5000-7000 RPM) zones for tachometer readability.
-   **Responsive Design**: Optimized for various screen sizes, including kiosk mode for Raspberry Pi deployments.

### Feature Specifications
- **Real-time Telemetry**: Displays RPM, speed, coolant temp, A/F ratio, MAP, fuel level.
- **Warning Thresholds**: Configurable for various parameters (e.g., low oil pressure, check engine light).
- **Quarter Mile Timer**: Dedicated page for drag timing, using live ECU speed data when available or simulation.
- **KPro USB Integration**: Implements KPro V4 native USB protocol for data acquisition, including USB device selection UI.
- **Offline Capabilities**: Designed for Raspberry Pi deployment with offline data storage and functionality, including systemd services for server and display management.

## External Dependencies

### Database
- **Drizzle ORM**: Configured for PostgreSQL (schema in `shared/schema.ts`).
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable. (Currently uses in-memory storage, database integration ready).

### Offline Raspberry Pi Packages
- **Chromium package**: Downloadable ZIP for kiosk mode (~370KB).
- **Native headless package**: Downloadable ZIP without Chromium dependency (~370KB), includes systemd services for server and display (surf browser).
- **Bundled ws module**: WebSocket library included for offline use.
- **Bundled Fonts**: Orbitron, Rajdhani, Inter, Roboto Mono (woff2).
- **Standalone Server**: `standalone-server.js` (Node.js HTTP + WS server with ELM327 serial support).
- **Scripts**: `start.sh`, `stop.sh`, `setup-hotspot.sh`, `undo-hotspot.sh`.
- **serialport**: Optional native module for server-side USB on Pi.

### UI/Styling
- **Fonts**: Orbitron, Rajdhani, Inter, Roboto Mono (bundled locally).
- **Radix UI**: Headless component primitives.
- **Lucide React**: Icon library.

### Real-time Communication
- **WebSocket (ws)**: Server-side implementation for telemetry streaming.

### Build & Development
- **Vite**: Frontend bundling.
- **esbuild**: Server-side bundling.
- **TypeScript**: Full type safety.