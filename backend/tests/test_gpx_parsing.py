"""Tests for gpx_parsing.py"""

import pytest
import pandas as pd
from app.gpx_parsing import parse_gpx_to_dataframe
from pandas.testing import assert_frame_equal

# Sample GPX data
VALID_GPX_STRING = """<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <metadata>
    <name>Test GPX</name>
  </metadata>
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="34.052235" lon="-118.243683">
        <ele>70.0</ele>
        <time>2023-01-01T12:00:00Z</time>
      </trkpt>
      <trkpt lat="34.052230" lon="-118.243680">
        <ele>71.0</ele>
        <time>2023-01-01T12:00:05Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""

# GPX with no track points, only metadata
GPX_NO_TRACKPOINTS_STRING = """<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <metadata>
    <name>Test GPX No Trackpoints</name>
  </metadata>
  <wpt lat="34.052235" lon="-118.243683">
    <name>Waypoint 1</name>
  </wpt>
</gpx>
"""

INVALID_GPX_STRING = """<?xml version="1.0" encoding="UTF-8"?>
<gpx>
  <invaliddata>
</gpx>
"""

def test_parse_valid_gpx():
    gpx_bytes = VALID_GPX_STRING.encode('utf-8')
    df = parse_gpx_to_dataframe(gpx_bytes)

    assert not df.empty
    expected_columns = ['timestamp', 'position_lat', 'position_long', 'altitude']
    assert all(col in df.columns for col in expected_columns)

    assert df['timestamp'].dtype == 'datetime64[ns, UTC]'
    assert pd.api.types.is_float_dtype(df['position_lat'])
    assert pd.api.types.is_float_dtype(df['position_long'])
    assert pd.api.types.is_float_dtype(df['altitude'])

    assert len(df) == 2
    assert df['position_lat'].iloc[0] == 34.052235
    assert df['altitude'].iloc[1] == 71.0
    assert df['timestamp'].iloc[0] == pd.Timestamp('2023-01-01T12:00:00Z', tz='UTC')

def test_parse_gpx_no_trackpoints():
    gpx_bytes = GPX_NO_TRACKPOINTS_STRING.encode('utf-8')
    df = parse_gpx_to_dataframe(gpx_bytes)
    
    expected_columns = ['timestamp', 'position_lat', 'position_long', 'altitude']
    expected_df = pd.DataFrame(columns=expected_columns)
    # Ensure dtypes match for empty DataFrame comparison (important for older pandas versions)
    expected_df = expected_df.astype({
        'timestamp': 'datetime64[ns, UTC]', # parse_gpx_to_dataframe converts to UTC
        'position_lat': 'float64',
        'position_long': 'float64',
        'altitude': 'float64'
    })

    assert df.empty
    assert_frame_equal(df, expected_df, check_dtype=True)


def test_parse_invalid_gpx():
    gpx_bytes = INVALID_GPX_STRING.encode('utf-8')
    with pytest.raises(ValueError, match="Error parsing GPX data"):
        parse_gpx_to_dataframe(gpx_bytes)

def test_parse_empty_gpx():
    gpx_bytes = b""
    with pytest.raises(ValueError, match="Error parsing GPX data"):
        parse_gpx_to_dataframe(gpx_bytes)

def test_gpx_with_missing_elevation_time():
    gpx_string = """<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="34.052235" lon="-118.243683"></trkpt>
      <trkpt lat="34.052230" lon="-118.243680">
        <ele>71.0</ele>
      </trkpt>
      <trkpt lat="34.052225" lon="-118.243675">
        <time>2023-01-01T12:00:05Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
"""
    gpx_bytes = gpx_string.encode('utf-8')
    df = parse_gpx_to_dataframe(gpx_bytes)
    
    assert len(df) == 3
    assert df['altitude'].isnull().sum() == 2 # First and third points have no elevation
    assert df['timestamp'].isnull().sum() == 2 # First and second points have no time
    
    assert df['altitude'].iloc[1] == 71.0
    assert pd.isna(df['altitude'].iloc[0])
    assert pd.isna(df['timestamp'].iloc[1])
    assert df['timestamp'].iloc[2] == pd.Timestamp('2023-01-01T12:00:05Z', tz='UTC')

    assert df['timestamp'].dtype == 'datetime64[ns, UTC]'
    assert pd.api.types.is_float_dtype(df['position_lat'])
    assert pd.api.types.is_float_dtype(df['position_long'])
    assert pd.api.types.is_float_dtype(df['altitude'])
