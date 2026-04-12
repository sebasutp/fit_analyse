import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from app.services import analysis
from app import model

class TestTemperature(unittest.TestCase):

    def test_compute_activity_summary_with_temperature(self):
        # Mock ride_df with temperature data
        ride_df = pd.DataFrame({
            'timestamp': pd.to_datetime(['2025-01-01 10:00:00', '2025-01-01 10:00:10']),
            'distance': [0, 100],
            'speed': [10, 10],
            'temperature': [20, 30] # Average should be 25
        })
        
        summary = analysis.compute_activity_summary(ride_df)
        
        self.assertIsNotNone(summary.average_temperature)
        self.assertEqual(summary.average_temperature, 25.0)

    def test_compute_activity_summary_without_temperature(self):
        # Mock ride_df without temperature data
        ride_df = pd.DataFrame({
            'timestamp': pd.to_datetime(['2025-01-01 10:00:00', '2025-01-01 10:00:10']),
            'distance': [0, 100],
            'speed': [10, 10]
        })
        
        summary = analysis.compute_activity_summary(ride_df)
        
        self.assertIsNone(summary.average_temperature)

    def test_compute_lap_metrics_with_temperature(self):
        # Mock lap_data_row with avg_temperature
        lap_data_row = pd.Series({
            'start_time': '2025-01-01 10:00:00',
            'timestamp': '2025-01-01 10:05:00',
            'total_distance': 5000,
            'avg_temperature': 22
        })
        
        # Mock activity_df
        activity_df = pd.DataFrame({
            'timestamp': pd.to_datetime(['2025-01-01 10:01:00']),
            'power': [200]
        })
        
        lap_metrics = analysis.compute_lap_metrics(lap_data_row, activity_df)
        
        self.assertEqual(lap_metrics.average_temperature, 22)

    def test_compute_lap_metrics_without_temperature(self):
        # Mock lap_data_row without avg_temperature
        lap_data_row = pd.Series({
            'start_time': '2025-01-01 10:00:00',
            'timestamp': '2025-01-01 10:05:00',
            'total_distance': 5000
        })
        
        activity_df = pd.DataFrame({
            'timestamp': pd.to_datetime(['2025-01-01 10:01:00']),
            'power': [200]
        })
        
        lap_metrics = analysis.compute_lap_metrics(lap_data_row, activity_df)
        
        self.assertIsNone(lap_metrics.average_temperature)

if __name__ == '__main__':
    unittest.main()
