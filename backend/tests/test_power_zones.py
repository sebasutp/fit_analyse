
import pytest
import pandas as pd
from app.services import analysis
from app import model

def test_calculate_time_in_zones():
    # 1. Basic case
    data = {
        'timestamp': pd.date_range(start='2021-01-01 10:00:00', periods=5, freq='1s'),
        'power': [100, 160, 210, 260, 450]
    }
    df = pd.DataFrame(data)
    zones = [150, 200, 250, 300, 350, 400]
    # Zones:
    # Z1: 0-150 (>0, <=150) -> 100 is Z1
    # Z2: 151-200 (>150, <=200) -> 160 is Z2
    # Z3: 201-250 -> 210 is Z3
    # Z4: 251-300 -> 260 is Z4
    # Z5, Z6
    # Z7: >400 -> 450 is Z7
    
    # Expected: 1s in Z1, 1s in Z2, 1s in Z3, 1s in Z4, 0s in Z5, 0s in Z6, 1s in Z7
    expected = [1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0]
    
    result = analysis.calculate_time_in_zones(df, zones)
    assert result == expected

def test_calculate_time_in_zones_empty():
    result = analysis.calculate_time_in_zones(pd.DataFrame(), [150, 200])
    assert result == []

def test_calculate_time_in_zones_no_power():
    df = pd.DataFrame({'timestamp': [1,2,3]})
    result = analysis.calculate_time_in_zones(df, [150, 200])
    assert result == []

def test_calculate_time_in_zones_no_zones():
    df = pd.DataFrame({'power': [100]})
    result = analysis.calculate_time_in_zones(df, [])
    assert result == []

def test_calculate_time_in_zones_irregular_time():
    # Although the current implementation assumes 1s for robustness or simplicity as per code comments,
    # let's verify it behaves as implemented (count of rows).
    data = {
        'timestamp': pd.date_range(start='2021-01-01 10:00:00', periods=3, freq='2s'), # 2s gaps
        'power': [100, 100, 100]
    }
    df = pd.DataFrame(data)
    zones = [150]
    # 3 samples, all in Z1.
    # Implementation says: durations = np.ones(len(df)). So sum should be 3.
    result = analysis.calculate_time_in_zones(df, zones)
    assert result == [3.0, 0.0]

