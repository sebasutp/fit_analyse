import unittest
import pandas as pd
from app.services import data_processing

class TestSmoothing(unittest.TestCase):

    def test_smooth_dataframe_with_gaps(self):
        # 10s gap: 1000 to 1010
        df = pd.DataFrame({
            'timestamp': [1000, 1010],
            'power': [100, 200],
            'heart_rate': [140, 150]
        })
        
        # Resampled to 1s, it should have 11 rows (1000 to 1010)
        smoothed = data_processing.smooth_dataframe(df, ['power', 'heart_rate'], window=3)
        self.assertEqual(len(smoothed), 11)
        
        # Power in gaps should be 0
        self.assertEqual(smoothed['power'].iloc[5], 0.0)
        # Power smoothed should be 0 in the middle of a 10s gap with window 3
        self.assertEqual(smoothed['power_smoothed'].iloc[5], 0.0)
        
        # HR in gaps should be interpolated
        # (140 + 150) / 2 = 145 at index 5
        self.assertAlmostEqual(smoothed['heart_rate'].iloc[5], 145.0)
        self.assertAlmostEqual(smoothed['heart_rate_smoothed'].iloc[5], 145.0)

    def test_downsample_dataframe(self):
        # 1000 rows
        dates = pd.date_range(start='2024-01-01', periods=1000, freq='s')
        df = pd.DataFrame({
            'timestamp': dates.view('int64') // 10**9,
            'power': range(1000)
        })
        
        # Downsample to 100 points
        downsampled = data_processing.downsample_dataframe(df, target_points=100)
        # 1000 / 100 = 10s freq. approx 100 points
        self.assertLessEqual(len(downsampled), 110)
        self.assertGreaterEqual(len(downsampled), 90)

if __name__ == '__main__':
    unittest.main()
