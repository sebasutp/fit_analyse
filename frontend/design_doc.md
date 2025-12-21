# Frontend Design Document

## Overview
The frontend is a Single Page Application (SPA) built with **React**, **Vite**, and **Tailwind CSS**. It interacts with a **FastAPI** backend to manage and analyze fitness activities (FIT/GPX files).

## Architecture
- **Build Tool**: Vite (fast development server and optimized build).
- **Framework**: React (Functional Components + Hooks).
- **Styling**: Tailwind CSS (Utility-first CSS).
- **Routing**: `react-router-dom`.
- **HTTP Client**: `axios` (configured with interceptors for JWT).
- **State Management**: React Context (`AuthContext`) + Local Component State + Custom Hooks.

## Directory Structure
```
src/
├── api/            # Axios client configuration
├── assets/         # Static assets (images, etc.)
├── components/     # UI Components
│   ├── activity/   # Activity-specific components
│   ├── batch/      # Batch upload components
│   ├── power/      # Power curve components
│   └── ...         # Generic/Shared components
├── contexts/       # React Contexts (Auth)
├── hooks/          # Custom Reusable Hooks
├── test/           # Test setup and utilities
├── App.jsx         # Main App Component + Routing
└── main.jsx        # Entry Point
```

## Key Components

### 1. Activities (`src/components/Activities.jsx`)
- **Purpose**: Displays a paginated list of activities with filtering capabilities.
- **Logic**: Uses `useActivities` hook.
- **Sub-components**: 
    - `ActivityFilters`: Search input and "Recorded" vs "Route" tabs.
    - `ActivityCard`: (Implicitly used) Renders individual activity summary.

### 2. View Activity (`src/components/ViewActivity.jsx`)
- **Purpose**: detailed view of a single activity. Shows map, power curve, and metrics.
- **Logic**: Uses `useActivity` hook.
- **Features**:
    - Editable Title/Date.
    - Deletion capability.
    - Interactive Leaflet Map (`RouteMap`).
    - Power Curve Chart (`PowerCurve`).
- **Sub-components**:
    - `ActivityMetricsGrid`: Displays key stats (Distance, Speed, Time, Elevation).

### 3. Batch Upload (`src/components/BatchUpload.jsx`)
- **Purpose**: Allows bulk uploading of FIT/GPX files from a directory.
- **Logic**: Uses `useBatchUpload` hook.
- **Features**:
    - Client-side SHA-256 hashing to detect duplicates before upload.
    - Upload status tracking (Pending -> Hashing -> Uploading -> Success/Skipped).
- **Sub-components**:
    - `UploadFileSelect`: File/Folder input.
    - `UploadStatusTable`: Progress table.

### 4. Authentication (`src/components/Login.jsx`, `src/components/LoginCallback.jsx`)
- **Purpose**: Handles user login via external providers (Strava/Google) or local dev auth.
- **Logic**: 
    - `Login`: Redirects to backend OAuth endpoints.
    - `LoginCallback`: Processes the JWT token returned via URL fragment/query params.
    - `AuthContext`: Persists token in `localStorage` and provides `auth` state to the app.

## Custom Hooks
Refactored logic is encapsulated in reusable hooks:

| Hook | Purpose | Key Methods |
| :--- | :--- | :--- |
| **`useActivities`** | Manages activity list state. | `loadMore()`, `setSearchQuery()`, `setSelectedTab()` |
| **`useActivity`** | Manages single activity logic. | `updateActivity()`, `deleteActivity()`, `refetch()` |
| **`useBatchUpload`** | Manages batch upload process. | `handleFileSelection()`, `uploadBatch()` |

## API Layer (`src/api/client.js`)
- **Axios Instance**: Configured with `baseURL` from `VITE_BACKEND_URL`.
- **Interceptors**: Automatically attaches `Authorization: Bearer <token>` to every request using the token stored in `localStorage`.

## Testing
- **Framework**: Vitest + React Testing Library.
- **Strategy**:
    - **Unit Tests**: For Utils and Custom Hooks.
    - **Component Tests**: Smoke tests and integration tests for key flows (`NewActivity`, `LoginCallback`).
    - **Mocking**: `src/api/client` is mocked globally in `src/test/setup.js` to prevent network requests during tests.
