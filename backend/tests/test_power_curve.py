import unittest
import pandas as pd
from datetime import datetime
from app.services import analysis

class TestPowerCurve(unittest.TestCase):

    def test_calculate_power_curve(self):
        # Create a sample DataFrame with 10 seconds of data
        timestamps = [datetime(2023, 1, 1, 10, 0, i) for i in range(10)]
        # Power values: 100, 100, 100, 200, 200, 200, 100, 100, 100, 100
        # 1s max: 200
        # 2s max: 200
        # 3s max: 200
        # 5s max: (100+200+200+200+100)/5 = 160 or similar window
        power_values = [100, 100, 100, 200, 200, 200, 100, 100, 100, 100]
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'power': power_values
        })
        
        # Determine expected durations based on the implementation plan or standard logical steps
        # The plan mentioned: [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200]
        # Since our data is only 10s long, we expect values for 1, 2, 5, 10.
        # Durations larger than total time might be omitted or return None/0.
        
        curve = analysis.calculate_power_curve(df)
        
        # Convert list of dicts to a dict for easier assertion {duration: power}
        curve_dict = {item['duration']: item['max_watts'] for item in curve}
        
        self.assertAlmostEqual(curve_dict[1], 200.0)
        self.assertAlmostEqual(curve_dict[2], 200.0)
        # Best 5s window: 100, 200, 200, 200, 100 -> sum=800 -> avg=160
        self.assertAlmostEqual(curve_dict[5], 160.0)
        # Best 10s window: sum(all)/10 = 1300/10 = 130
        self.assertAlmostEqual(curve_dict[10], 130.0)

    def test_calculate_power_curve_empty(self):
        df = pd.DataFrame({'timestamp': [], 'power': []})
        curve = analysis.calculate_power_curve(df)
        self.assertEqual(curve, [])

    def test_calculate_power_curve_missing_columns(self):
        df = pd.DataFrame({'other': [1, 2, 3]})
        curve = analysis.calculate_power_curve(df)
        self.assertEqual(curve, [])

    def test_merge_power_curves(self):
        curve1 = [{'duration': 1, 'max_watts': 200}, {'duration': 10, 'max_watts': 150}]
        curve2 = [{'duration': 1, 'max_watts': 250}, {'duration': 10, 'max_watts': 100}]
        
        merged = analysis.merge_power_curves(curve1, curve2)
        merged_dict = {item['duration']: item['max_watts'] for item in merged}
        
        self.assertEqual(merged_dict[1], 250)
        self.assertEqual(merged_dict[10], 150)
        
    def test_merge_power_curves_different_durations(self):
        curve1 = [{'duration': 1, 'max_watts': 200}]
        curve2 = [{'duration': 5, 'max_watts': 180}]
        
        merged = analysis.merge_power_curves(curve1, curve2)
        merged_dict = {item['duration']: item['max_watts'] for item in merged}
        
        self.assertEqual(merged_dict[1], 200)
        self.assertEqual(merged_dict[5], 180)

    def test_update_user_curves_incremental(self):
        # Base Curve
        user_curves = {
            'all': [{'duration': 1, 'max_watts': 200}],
            '3m': [{'duration': 1, 'max_watts': 200}]
        }
        
        # New activity curve (better)
        new_curve = [{'duration': 1, 'max_watts': 300}]
        
        # Test Case 1: Recent activity (should update all and 3m)
        recent_date = datetime.now()
        updated = analysis.update_user_curves_incremental(user_curves, new_curve, recent_date)
        
        # Check 'all'
        all_watts = {d['duration']: d['max_watts'] for d in updated['all']}
        self.assertEqual(all_watts[1], 300)
        
        # Check '3m'
        m3_watts = {d['duration']: d['max_watts'] for d in updated['3m']}
        self.assertEqual(m3_watts[1], 300)
        
    def test_update_user_curves_incremental_old_activity(self):
        # Base Curve
        user_curves = {
            'all': [{'duration': 1, 'max_watts': 200}],
            '3m': [{'duration': 1, 'max_watts': 200}]
        }
        
        # New activity curve (better)
        new_curve = [{'duration': 1, 'max_watts': 300}]
        
        # Test Case 2: Old activity (should update 'all' but NOT '3m')
        # 4 months ago
        from datetime import timedelta
        old_date = datetime.now() - timedelta(days=120)
        
        updated = analysis.update_user_curves_incremental(user_curves, new_curve, old_date)
        
        # Check 'all' -> should be updated
        all_watts = {d['duration']: d['max_watts'] for d in updated['all']}
        self.assertEqual(all_watts[1], 300)
        
        # Check '3m' -> should NOT be updated (remain 200)
        m3_watts = {d['duration']: d['max_watts'] for d in updated['3m']}
        self.assertEqual(m3_watts[1], 200)

if __name__ == '__main__':
    unittest.main()
