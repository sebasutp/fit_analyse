import pytest
from datetime import datetime, timedelta
from app import model
from app.services import stats

def test_volume_excludes_routes(client, dbsession, auth_headers, test_user):
    """
    Verifies that 'route' activities are NOT included in the Weekly Training Volume stats.
    This targets the HistoricalStats table which powers the /volume endpoint.
    """
    # 1. Clear existing stats for cleaner test
    # (Assuming test_user is fresh or we rely on explicit checks)
    
    # 2. Insert a Route (Planned Activity) - Should be IGNORED
    route = model.ActivityTable(
        activity_id="test_route_vol", name="Planned Long Ride", owner_id=test_user.id, activity_type="route",
        distance=10000.0, # 10,000 km
        active_time=36000.0, 
        elevation_gain=5000.0, 
        total_work=0,
        date=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        data=b""
    )
    # We must trigger stats update. In real app, upload_activity calls update_stats_incremental.
    # Here we can call it manually to simulate the service layer behavior.
    stats.update_stats_incremental(dbsession, test_user.id, route, operation="add")
    dbsession.add(route)
    dbsession.commit()
    
    # 3. Insert a Real Ride - Should be COUNTED
    ride = model.ActivityTable(
        activity_id="test_ride_vol", name="Real Ride", owner_id=test_user.id, activity_type="Ride",
        distance=50.0, # 50 km
        active_time=7200.0, # 2 hours
        elevation_gain=500.0, 
        total_work=1000,
        date=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        data=b""
    )
    stats.update_stats_incremental(dbsession, test_user.id, ride, operation="add")
    dbsession.add(ride)
    dbsession.commit()
    
    # 4. Fetch Volume Stats
    # The /volume endpoint defaults to '3m' which includes current week.
    response = client.get("/users/me/stats/volume?period=3m", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    # 5. Verify data
    # Find the current week's bucket
    today_iso = datetime.utcnow().isocalendar()
    current_week_str = f"{today_iso.year}-W{today_iso.week:02d}"
    
    week_stat = next((item for item in data if item["week"] == current_week_str), None)
    assert week_stat is not None, "Should have stats for current week"
    
    # 6. Assert Volume matches ONLY the ride
    # If bug exists, distance will be 10050.0
    # If fixed, distance will be 50.0
    print(f"DEBUG: Week Distance = {week_stat['distance']}")
    assert week_stat["distance"] == pytest.approx(50.0, 0.1), f"Expected 50.0 km, got {week_stat['distance']} km. Routes included?"
