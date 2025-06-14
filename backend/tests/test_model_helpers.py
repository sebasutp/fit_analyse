import unittest
import pandas as pd
from app import model
from app import model_helpers
from unittest.mock import patch
import io
import pyarrow.feather as feather
from datetime import datetime

class TestModelHelpers(unittest.TestCase):

    def test_remove_columns(self):
        df = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4], 'col3': [5, 6]})
        result_df = model_helpers.remove_columns(df, ['col2', 'col3'])
        self.assertListEqual(list(result_df.columns), ['col1'])

    def test_serialize_deserialize_dataframe(self):
        df = pd.DataFrame({'col1': [1, 2], 'col2': [3.0, 4.0], 'col3': [True, False], 'left_right_balance': [1, 2]})
        serialized = model_helpers.serialize_dataframe(df)
        deserialized_df = model_helpers.deserialize_dataframe(serialized)

        self.assertIsInstance(serialized, bytes)
        self.assertIsInstance(deserialized_df, pd.DataFrame)
        self.assertListEqual(list(deserialized_df.columns), ['col1', 'col2', 'col3'])

        pd.testing.assert_frame_equal(deserialized_df, df[['col1', 'col2', 'col3']])

    def test_compute_elevation_gain_intervals(self):
        df = pd.DataFrame({
            'altitude': [10, 12, 15, 14, 16, 13, 17, 18, 16]
        })
        intervals = model_helpers.compute_elevation_gain_intervals(df, tolerance=0.5, min_elev=2.0)
        self.assertEqual(len(intervals), 2)
        self.assertEqual(intervals[0].from_ix, 0)
        self.assertEqual(intervals[0].to_ix, 2)
        self.assertEqual(intervals[0].elevation, 5.0)
        self.assertEqual(intervals[1].from_ix, 5)
        self.assertEqual(intervals[1].to_ix, 7)
        self.assertEqual(intervals[1].elevation, 5.0)

    def test_compute_elevation_gain_intervals_empty(self):
        df = pd.DataFrame({
            'altitude': [10, 10, 10, 10, 10, 10, 10]
        })
        intervals = model_helpers.compute_elevation_gain_intervals(df, tolerance=1.0, min_elev=2.0)
        self.assertEqual(len(intervals), 0)
        
    def test_compute_elevation_gain(self):
        df = pd.DataFrame({
            'altitude': [10, 12, 15, 14, 16, 13, 17, 18, 16]
        })
        total_gain = model_helpers.compute_elevation_gain(df, tolerance=0.5, min_elev=2.0)
        self.assertEqual(total_gain, 10.0)


    @patch('app.model_helpers.StaticMap')
    @patch('os.getenv')
    def test_get_activity_map(self, mock_getenv, MockStaticMap):
        mock_getenv.return_value = "400"
        ride_df = pd.DataFrame({
            'position_lat': [1, 2, 3, 4, 5],
            'position_long': [6, 7, 8, 9, 10]
        })
        model_helpers.get_activity_map(ride_df, num_samples=2)
        MockStaticMap.assert_called_once()

    def test_compute_activity_summary(self):
        df = pd.DataFrame({
            'distance': [0, 100, 200, 300, 400, 500],
            'timestamp': [datetime(2023, 1, 1, 10, 0, 0),
                          datetime(2023, 1, 1, 10, 0, 1),
                          datetime(2023, 1, 1, 10, 0, 2),
                          datetime(2023, 1, 1, 10, 0, 3),
                          datetime(2023, 1, 1, 10, 0, 4),
                          datetime(2023, 1, 1, 10, 0, 5)
            ],
            'speed': [1.0, 2.0, 3.0, 2.0, 1.0, 2.0],
            'altitude': [10, 12, 15, 14, 16, 13],
            'power': [100, 200, 300, 250, 150, 200]
        })
        summary = model_helpers.compute_activity_summary(df)
        self.assertAlmostEqual(summary.distance, 0.5)
        self.assertAlmostEqual(summary.total_elapsed_time, 5.0)
        self.assertAlmostEqual(summary.average_speed, (11.0 / 6.0) * 3.6)
        self.assertAlmostEqual(summary.elevation_gain, 6.0)

        self.assertAlmostEqual(summary.power_summary.average_power, 200.0)
        self.assertAlmostEqual(summary.power_summary.total_work, 1.1)
        self.assertAlmostEqual(summary.power_summary.median_power, 200.0)
        self.assertEqual(len(summary.power_summary.quantiles), 101)

        self.assertAlmostEqual(summary.elev_summary.lowest, 10.0)
        self.assertAlmostEqual(summary.elev_summary.highest, 16.0)
        self.assertEqual(len(summary.elev_summary.elev_series), 6)
        self.assertEqual(len(summary.elev_summary.dist_series), 6)
        
    def test_compute_activity_summary_no_power(self):
        df = pd.DataFrame({
            'distance': [0, 100, 200, 300, 400, 500],
            'timestamp': [datetime(2023, 1, 1, 10, 0, 0),
                          datetime(2023, 1, 1, 10, 0, 1),
                          datetime(2023, 1, 1, 10, 0, 2),
                          datetime(2023, 1, 1, 10, 0, 3),
                          datetime(2023, 1, 1, 10, 0, 4),
                          datetime(2023, 1, 1, 10, 0, 5)
            ],
            'speed': [1.0, 2.0, 3.0, 2.0, 1.0, 2.0],
            'altitude': [10, 12, 15, 14, 16, 13]
        })
        summary = model_helpers.compute_activity_summary(df)
        self.assertAlmostEqual(summary.distance, 0.5)
        self.assertAlmostEqual(summary.total_elapsed_time, 5.0)
        self.assertAlmostEqual(summary.average_speed, (11.0 / 6.0) * 3.6)
        self.assertAlmostEqual(summary.elevation_gain, 6.0)
        self.assertIsNone(summary.power_summary)

    def test_get_activity_raw_df(self):
      # Create a sample DataFrame
      sample_df = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4]})

      # Serialize the DataFrame to simulate storing it in the database
      serialized_df = model_helpers.serialize_dataframe(sample_df)

      # Create a mock ActivityTable object
      mock_activity_table = model.ActivityTable(
          activity_id="test_id",
          name="test_activity",
          owner_id=1,
          distance=10.0,
          active_time=100.0,
          elevation_gain=5.0,
          date=datetime.now(),
          last_modified=datetime.now(),
          data=serialized_df,
      )

      # Call the function
      result_df = model_helpers.get_activity_raw_df(mock_activity_table)

      # Assertions
      self.assertIsInstance(result_df, pd.DataFrame)
      pd.testing.assert_frame_equal(result_df, sample_df)

    def test_get_activity_response(self):
      # Create a sample DataFrame
      sample_df = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4],
            'distance': [0, 100],
            'timestamp': [datetime(2023, 1, 1, 10, 0, 0),
                          datetime(2023, 1, 1, 10, 0, 1)
            ],
            'speed': [1.0, 2.0],
            'altitude': [10, 12]
        })

      # Serialize the DataFrame to simulate storing it in the database
      serialized_df = model_helpers.serialize_dataframe(sample_df)

      # Create a mock ActivityTable object
      mock_activity_table = model.ActivityTable(
          activity_id="test_id",
          name="test_activity",
          owner_id=1,
          distance=10.0,
          active_time=100.0,
          elevation_gain=5.0,
          date=datetime.now(),
          last_modified=datetime.now(),
          data=serialized_df,
      )
      activity_response = model_helpers.get_activity_response(mock_activity_table)
      self.assertIsNotNone(activity_response.activity_analysis)
      self.assertIsInstance(activity_response.activity_base, model.ActivityBase)

    @patch('app.model_helpers.Session')
    def test_fetch_activity(self, MockSession):
        # Mocking the session behavior
        mock_session = MockSession.return_value
        mock_session.exec.return_value.first.return_value = "mock_activity"

        # Call the function
        result = model_helpers.fetch_activity("some_id", mock_session)

        # Assertions
        self.assertEqual(result, "mock_activity")

        # Test for HTTPException when no activity is found
        mock_session.exec.return_value.first.return_value = None
        with self.assertRaises(Exception) as context:
            model_helpers.fetch_activity("some_id", mock_session)
        self.assertEqual(context.exception.status_code, 404)

    def test_get_activity_df(self):
      # Create a sample DataFrame
      sample_df = pd.DataFrame({
            'col1': [1, 2], 
            'col2': [3, 4],
            'timestamp': [datetime(2023, 1, 1, 10, 0, 0),
                          datetime(2023, 1, 1, 10, 0, 1)]
        })
      
      serialized_df = model_helpers.serialize_dataframe(sample_df)

      mock_activity_table = model.ActivityTable(
          activity_id="test_id",
          name="test_activity",
          owner_id=1,
          distance=10.0,
          active_time=100.0,
          elevation_gain=5.0,
          date=datetime.now(),
          last_modified=datetime.now(),
          data=serialized_df,
      )

      df = model_helpers.get_activity_df(mock_activity_table)
      self.assertListEqual(list(df.columns), ["col1", "col2", "timestamp"])
      self.assertAlmostEqual(df.timestamp[0], 1672567200.0)

    @patch('app.model_helpers.fetch_activity')
    def test_fetch_activity_df(self, mock_fetch_activity):
        # Create a sample DataFrame
        sample_df = pd.DataFrame({'col1': [1, 2], 'col2': [3, 4],
            'timestamp': [datetime(2023, 1, 1, 10, 0, 0),
                          datetime(2023, 1, 1, 10, 0, 1)
            ]})

        # Simulate the activity table returned by fetch_activity
        serialized_df = model_helpers.serialize_dataframe(sample_df)
        mock_activity_table = model.ActivityTable(
            activity_id="test_id",
            name="test_activity",
            owner_id=1,
            distance=10.0,
            active_time=100.0,
            elevation_gain=5.0,
            date=datetime.now(),
            last_modified=datetime.now(),
            data=serialized_df,
        )

        mock_fetch_activity.return_value = mock_activity_table

        # Call the function
        df = model_helpers.fetch_activity_df("some_id", "some_session")
        self.assertListEqual(list(df.columns), ["col1", "col2", "timestamp"])

if __name__ == '__main__':
    unittest.main()
