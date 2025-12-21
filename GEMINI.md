# Project Overview

This is a full-stack web application for analyzing fitness data from FIT and GPX files. The backend is a Python FastAPI server, and the frontend is a React application.

**Backend:**
- **Framework:** FastAPI
- **Database:** SQLModel (SQLite by default)
- **Authentication:** JWT
- **File Parsing:** `fitparse` for FIT files, `gpxpy` for GPX files, and a Go executable for additional FIT file processing.

**Frontend:**
- **Framework:** React
- **Build Tool:** Vite
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **Charts:** Chart.js and Recharts
- **Maps:** Leaflet

# Building and Running

## Backend

Make sure to use Python 3.10 or newer.

1.  **Create and activate a virtual environment:**
    ```sh
    python3 -m venv backend/venv && source backend/venv/bin/activate
    ```
2.  **Install the requirements:**
    ```sh
    pip install -r backend/requirements.txt
    ```
3.  **Create a `.env` file in the `backend` folder and add the following configuration:**
    ```
    JWT_SECRET="some random secret key"
    JWT_ALGORITHM="HS256"
    DB_URL="sqlite:///database.db"
    TOKEN_TIMEOUT=30
    PORT=8082
    SEARCH_MATCH_THRESHOLD=75 # Optional: Fuzzy match threshold (0-100), default 75
    ```
4.  **Create the database:**
    ```sh
    alembic -c backend/alembic.ini upgrade head
    ```
5.  **Run the app:**
    ```sh
    python backend/main.py
    ```

## Frontend

1.  **Install dependencies:**
    ```sh
    npm install --prefix frontend
    ```
2.  **Run the development server:**
    ```sh
    npm run dev --prefix frontend
    ```

# Development Conventions

- The backend code follows the FastAPI project structure.
- The frontend code uses React with functional components and hooks.
- The project uses a client-server architecture with a RESTful API.

# Testing

## Backend

The backend tests are located in the `backend/tests` directory and use `pytest`.

To run the backend tests:

1.  **Activate the virtual environment:**
    ```sh
    source backend/venv/bin/activate
    ```
2.  **Run the tests:**
    ```sh
    pytest backend/tests/
    ```

## Frontend

The frontend tests are located in the `frontend/src/components` directory and use `vitest` and `react-testing-library`.

To run the frontend tests:

1.  **Navigate to the `frontend` directory:**
    ```sh
    cd frontend
    ```
2.  **Run the tests:**
    ```sh
    npm test -- --run
    ```

# Search Functionality

The application uses fuzzy search (via `rapidfuzz`) to rank activities. This allows for:
- **Partial Matching**: "zer" matches "Zermatt".
- **Fuzzy Matching**: Handles misspellings (e.g., "Zermmat" matches "Zermatt").
- **Order Independence**: "Ride Zermatt" matches "Zermatt Ride".

The search threshold is configurable via the `SEARCH_MATCH_THRESHOLD` environment variable (default: 75). A higher value requires a closer match, while a lower value is more permissive.
