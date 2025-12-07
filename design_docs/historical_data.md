# Historical Data

The goal is to provide the user with historical statistics that are motivating to keep training
and understand their progress. This are the features we want to provide:

## Basic statistics for the user itself

We want to provide the following statistics for the running year, all time, and previous years
the user can select from her history:
- Total number of kilometers, hours and calories burned
- Number of activities in that period
- Total meters of elevation gain
- Longest activity (in km, hours, and meters of elevation gain).
- Fastest activity (in km/h)

## Analysis of training volume

We want to show a plot for a given number of months in the past (using the same configuration
as the power curves: ex: 3 months, 6 months, 1 year, all time). The plot should show the total
training volume for each month. The user can decide if she wants to see the training volume
in kilometers, hours, or calories burned. We should accumulate the training volume per week.

## Implementation Plan

### 1. Database Schema Changes

### 1.1. New Table: `HistoricalStats`
We will create a new table `HistoricalStats` (or `UserStats`) to store aggregated metrics for specific time buckets. This avoids expensive on-the-fly aggregation of all activities.

**Schema:**
*   `id`: Integer (PK)
*   `user_id`: Integer (FK to `User`)
*   `period_type`: String/Enum (`ALL`, `YEAR`, `MONTH`, `WEEK`)
*   `period_id`: String (Identifier for the period, e.g., "total", "2025", "2025-01")
*   `distance`: Float (Total distance in km)
*   `moving_time`: Float (Total moving time in seconds)
*   `elapsed_time`: Float (Total elapsed time in seconds)
*   `elevation_gain`: Float (Total elevation gain in meters)
*   `activity_count`: Integer (Number of activities)
*   `max_power`: Integer (Max power achieved during this period)
*   `last_updated`: DateTime

**Indexes:**
*   `(user_id, period_type, period_id)` (Unique Constraint) for fast lookups.

### 1.2. `ActivityTable` Enhancements
To facilitate efficient recalculations and "Best Activity" queries, we will ensure the `ActivityTable` has the following columns (some might be missing or only in JSON):
*   `max_power`: Integer (To be added)
*   `average_power`: Integer (To be added)
*   `calories`: Integer (To be added)

### 2. Pre-Computed Data (Saved in DB)

The following data will be stored persistently in the database:
1.  **Aggregated Stats (`HistoricalStats`)**: Totals for All-time, Years, and Months.


### 3. Computed in Batch / Background

These operations are resource-intensive and should be handled asynchronously or on-demand:

*   **Full Stats Rebuild**: A background job to iterate over *all* activities for a user and completely rebuild the `HistoricalStats` table. This is used for:
    *   Data migrations/Schema changes.
    *   Fixing data inconsistencies.
    *   Recovering from "Deleted Activity" scenarios if incremental updates are complex (see below).
*   **Ranking / Leaderboards**: (Future) Computing "Top 10 Efforts" lists can be done lazily or via a periodic job.

### 4. Refresh Logic (Incremental Updates)

To keep the UI snappy, we will update stats incrementally when activities are modified. Similarly to the power
curve implementation, we will also provide a batch job to update the stats for a user and provide the option to
run it on demand as well as a cron job to run it periodically.

#### 4.1. On Activity Upload (Creation)
When a new activity is saved:
1.  **Time Period Identification**: Determine the Year (e.g., "2025") and Month (e.g., "2025-10") of the activity.
2.  **Update Aggregates**:
    *   Fetch `HistoricalStats` rows for `ALL`, `YEAR`, `MONTH`, and `WEEK`.
    *   Increment `distance`, `moving_time`, `elevation_gain`, `activity_count` by the activity's values.
    *   Update `max_power` if the activity's `max_power` is greater than the stored value.
    *   Save changes.

#### 4.2. On Activity Delete
Do not update the historical stats on activity delete. Instead, rely on the periodic batch jobs (cron job) to update the stats.

#### 4.3. On Activity Update (Edit)
When an activity's metadata (Date) or data (Reprocessing) changes:
1.  **Date Change**:
    *   Decrement stats from the *Old* Period.
    *   Increment stats in the *New* Period.
2.  **Metrics Change**:
    *   Calculate Diff (`New - Old`).
    *   Apply Diff to the current periods.
    *   for `max_power`, handle similar to Delete (check if we removed the peak).

### 5. API Endpoints

*   `GET /users/me/stats`: Returns the `HistoricalStats` for the requested periods (defaulting to All-Time + Current Year).
*   `POST /users/me/stats/recalculate`: (Admin/Debug) Triggers a full rebuild of stats for the user.
*   `GET /users/me/stats/volume`: Returns a list of weekly aggregates for the training volume plot.
    *   Query Params: `period` (Enum: `3m`, `6m`, `1y`, `all`).

### 6. Frontend Implementation

#### 6.1. `TrainingVolumeChart` Component
We will create a specific component to visualize training volume.

*   **Libraries**: `react-chartjs-2` or `recharts` (consistent with existing charts).
*   **Controls**:
    *   **Time Period Selector**: Segmented control or buttons for `3 Months`, `6 Months`, `1 Year`, `All Time`.
    *   **Unit Selector**: Dropdown or buttons for `Distance (km)`, `Time (h)`, `Calories (kcal)`.
*   **Visualization**:
    *   **Bar Chart**: Each bar represents one week (Monday-Sunday).
    *   **Data Source**: Fetches from `GET /users/me/stats/volume`.
    *   **Interactivity**: Hover tooltip showing exact values for the week.

#### 6.2. User Profile Page
*   Integrate `HistoricalStats` (Basic Stats) at the top.
*   Embed `TrainingVolumeChart` below the basic stats.
