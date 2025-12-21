# Backend Design Document

## Overview

The backend is a FastAPI application designed to analyze fitness data from FIT and GPX files. It manages user activities, calculates performance metrics (power curves, training volume), and provides a RESTful API for the frontend.

## API Endpoints

### Activities (`/api/activity`)

| Method | Endpoint | Auth | Cost | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/upload_activity` | **Yes** | **High** <br> $O(Size)$ | Uploads a `.fit` or `.gpx` file. Parsing FIT file, processing DataFrames, running Go executable. Heavy CPU & I/O. |
| `GET` | `/{activity_id}` | **No** | **Medium** <br> $O(Size)$ | Fetches activity details. Always deserializes binary DataFrame to re-compute summary stats on read (unless optimized). Public via ID. |
| `PATCH` | `/{activity_id}` | **Yes** | **Low** <br> $O(1)$ | Updates activity metadata (name, tags, etc.). Simple SQL update. |
| `DELETE` | `/{activity_id}` | **Yes** | **Low** <br> $O(1)$ | Deletes an activity and its data. Simple SQL delete. |
| `GET` | `/{activity_id}/power-curve` | **No** | **High** <br> $O(T)$ | Calculates power curve. Deserializes DataFrame, resamples to 1s, computes rolling max. $T$ = Activity duration. |
| `GET` | `/{activity_id}/gpx` | **No** | **Medium** <br> $O(T)$ | Generates GPX file. Deserializes DataFrame, iterates all points to format XML. |
| `GET` | `/{activity_id}/raw` | **No** | **Medium** <br> $O(Size)$ | Streams raw activity columns. Deserializes DataFrame and streams as msgpack. |
| `GET` | `/{activity_id}/map` | **No** | **Low** <br> $O(1)$ | Returns cached static map image. (First call is **High** to generate it). |

### Activity Lists & Maps (`/api`)

| Method | Endpoint | Auth | Cost | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/activities` | **Yes** | **Variable** <br> $O(N)$ or $O(1)$ | Lists activities. <br> - **Low** ($O(\log N)$) if paginating by date/cursor. <br> - **High** ($O(N)$) if `search_query` is used (scans all activities in memory). |
| `GET` | `/activity_map/{activity_id}` | **No** | **Low** <br> $O(1)$ | Returns a static map image (PNG). Intecepts cached byte stream. |
| `GET` | `/activities/hashes` | **Yes** | **Low** <br> $O(N)$ | Returns a list of all activity hashes. fast Index Scan. |

### Statistics (`/api/users/me/stats`)

| Method | Endpoint | Auth | Cost | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | **Yes** | **Low** <br> $O(1)$ | Retreives historical stats (totals) for ALL time and current YEAR. Constant DB lookup. |
| `POST` | `/recalculate` | **Yes** | **Very High** <br> $O(N)$ | Triggers a full, synchronous rebuild of the user's `HistoricalStats` table. Iterates all user activities. |
| `GET` | `/summary` | **Yes** | **Low** <br> $O(N)$ | Aggregates stats for custom date range. DB performs efficient Sum/Max over indexed rows. |
| `GET` | `/volume` | **Yes** | **Low** <br> $O(N)$ | Returns weekly training volume. Fetches pre-computed weekly stats rows. |

---

## Complex Algorithms

### 1. Activity Search & Ranking
**Location:** `app.services.analysis.search_and_rank_activities`

*   **Mechanism:**
    1.  **Fetching:** Retreives **all** activities for the user matching the base filters (DB query).
    2.  **Tokenization:** Splits `search_query` into terms.
    3.  **Fuzzy Matching:** Iterates through every activity in memory.
        *   Matches each term against the activity `name` and `tags` using `rapidfuzz.partial_ratio`.
        *   Threshold: Default 75 (configurable via `SEARCH_MATCH_THRESHOLD`).
    4.  **Scoring:** Sums the best match scores for each term. If any term fails to match (score=0), the activity is excluded.
    5.  **Ranking:** Sorts by `score` (descending), then `date` (descending).

*   **Cost:** $O(N \cdot M \cdot L)$ where $N$ is activities, $M$ is search terms, $L$ is text length.
    *   *Note:* Currently performed in-memory on the full activity list content. Efficient for thousands of activities, but scalable limits exist without full-text search engine.

### 2. Power Curve Calculation
**Location:** `app.services.power.calculate_power_curve`

*   **Mechanism:**
    1.  **Resampling:** Resamples raw power data to 1-second intervals (filling gaps with 0).
    2.  **Rolling Max:** Computes the maximum rolling mean for a fixed set of critical durations (1s, 2s, 5s ... 5h).
    3.  **Result:** A list of `{duration, max_watts}`.

*   **Cost:** $O(D \cdot W)$ where $D$ is activity duration and $W$ is the number of curve points (small constant).
    *   Pandas optimized rolling window operations are fast, but deserializing the dataframe from binary blob is the I/O bottleneck.

### 3. Training Volume Aggregation
**Location:** `app.routers.stats.get_training_volume`

*   **Mechanism:**
    1.  **Aggregation:** Relies on pre-computed `HistoricalStats` rows with `period_type='WEEK'`.
    2.  **Filtering:** Fetches all WEEK stats and filters by date range in Python (due to ISO week complexity in SQL).
    3.  **Formatting:** Merges into a timeline for the frontend API.

*   **Cost:** Very Low (Index scan on `HistoricalStats`).

---

## Batch Jobs

The backend uses `APScheduler` (BackgroundScheduler) to run periodic maintenance tasks.
**Configuration:** `app.services.cron_jobs`

### 1. Global Power Curve Recomputation (`recompute_all_users_curves`)

*   **Purpose:** Rebuilds the "User Power Curve" (best-ever power for every duration) by re-scanning all past activities. Used if algorithms change or data corruption is suspected.
*   **Trigger:**
    *   Cron: Every 24 hours (default).
    *   Startup: Optional via flags.
*   **Algorithm:**
    ```python
    For each User:
      Reset user.power_curve
      For each Activity:
         Deserialize DataFrame (Heavy I/O)
         Calculate Power Curve (CPU)
         Merge into User Curve (Memory)
      Save User
    ```
*   **Cost:** **HIGH**.
    *   **I/O:** Reads complete binary data blobs for every activity in the database.
    *   **CPU:** Decompresses and processes pandas dataframes for every activity.
    *   *Scale Warning:* Will bottleneck as dataset grows > 10GB or activity count > 10k.

### 2. Historical Stats Recomputation (`recompute_all_users_stats`)

*   **Purpose:** Rebuilds the `HistoricalStats` table (weekly/monthly/yearly aggregations).
*   **Trigger:**
    *   Cron: Every 24 hours (default).
*   **Algorithm:**
    ```python
    For each User:
      Delete all HistoricalStats
      For each Activity:
         Read metadata (distance, time, etc.)
         If metadata missing: Deserialize blob to backfill (Medium I/O)
         Aggregate into in-memory Stats Map
      Batch Insert Stats
    ```
*   **Cost:** **Medium**.
    *   Mostly reads metadata columns (`distance`, `total_work`).
    *   Only hits heavy I/O if activity metadata is missing and needs backfilling from raw blobs.
    *   Efficient for typical usage.
