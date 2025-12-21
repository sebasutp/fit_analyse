import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import io
import pyarrow as pa
import pyarrow.ipc as pa_ipc
from app import fit_parsing
import os

class TestFitParsing(unittest.TestCase):

    @patch('app.fit_parsing.fitparse.FitFile')
    def test_fitparse_extract_data(self, MockFitFile):
        # Mocking fitparse.FitFile and its messages
        mock_fitfile = MockFitFile.return_value
        
        # simulated records
        mock_record1 = MagicMock()
        mock_record1.name = 'record'
        field1 = MagicMock()
        field1.name = 'speed'
        field1.value = 1000.0
        field2 = MagicMock()
        field2.name = 'distance'
        field2.value = 50.0
        mock_record1.fields = [field1, field2]
        
        mock_record2 = MagicMock()
        mock_record2.name = 'other_message' # Should be ignored
        
        mock_fitfile.messages = [mock_record1, mock_record2]
        
        df = fit_parsing.fitparse_extract_data(b'fake_data')
        
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]['speed'], 1000.0)
        self.assertEqual(df.iloc[0]['distance'], 50.0)

    @patch('app.fit_parsing.fitparse.FitFile')
    def test_fitparse_extract_data_position_scaling(self, MockFitFile):
        mock_fitfile = MockFitFile.return_value
        
        mock_record = MagicMock()
        mock_record.name = 'record'
        f1 = MagicMock()
        f1.name = 'position_lat'
        f1.value = 500000000 # Semicircles
        f2 = MagicMock()
        f2.name = 'position_long'
        f2.value = 600000000
        mock_record.fields = [f1, f2]
        
        mock_fitfile.messages = [mock_record]
        
        df = fit_parsing.fitparse_extract_data(b'fake_data')
        
        # Check scaling (deg = semicircles * (180 / 2^31) or / ((1<<32)/360))
        scale = (1 << 32) / 360.0
        expected_lat = 500000000 / scale
        self.assertAlmostEqual(df.iloc[0]['position_lat'], expected_lat)

    @patch('subprocess.Popen')
    def test_go_extract_data_success(self, mock_popen):
        # Create a real small Arrow table to serialize
        df_source = pd.DataFrame({'speed': [1000.0, 2000.0], 'distance': [10.0, 20.0]})
        table = pa.Table.from_pandas(df_source)
        sink = pa.BufferOutputStream()
        with pa_ipc.new_stream(sink, table.schema) as writer:
            writer.write_table(table)
        arrow_bytes = sink.getvalue().to_pybytes()
        
        process_mock = MagicMock()
        process_mock.communicate.return_value = (arrow_bytes, b'')
        process_mock.returncode = 0
        mock_popen.return_value = process_mock
        
        df = fit_parsing.go_extract_data("fake_go_path", b'fit_data')
        
        self.assertIsNotNone(df)
        # Note: go_extract_data does scaling!
        # scales: speed / 1000*3.6? No, 'speed': 1000.0 in the map.
        # speed = val / 1000.0 -> to m/s? Fit units are m/s scaled by 1000 usually.
        # Let's check the code: 'speed': 1000.0 in scales dict.
        # input 1000.0 -> output 1.0
        self.assertAlmostEqual(df.iloc[0]['speed'], 1.0)
        self.assertAlmostEqual(df.iloc[0]['distance'], 0.1) # scale 100.0

    @patch('subprocess.Popen')
    def test_go_extract_data_failure(self, mock_popen):
        process_mock = MagicMock()
        process_mock.communicate.return_value = (b'', b'some error')
        process_mock.returncode = 1
        mock_popen.return_value = process_mock
        
        df = fit_parsing.go_extract_data("fake_go_path", b'fit_data')
        
        self.assertIsNone(df)

    @patch('app.fit_parsing.go_extract_data')
    @patch('app.fit_parsing.fitparse_extract_data')
    @patch('os.getenv')
    def test_extract_data_to_dataframe_uses_go_if_env_set(self, mock_getenv, mock_fitparse, mock_go):
        mock_getenv.return_value = "/path/to/go/exe"
        mock_go.return_value = pd.DataFrame()
        
        fit_parsing.extract_data_to_dataframe(b'data')
        
        mock_go.assert_called_once()
        mock_fitparse.assert_not_called()

    @patch('app.fit_parsing.go_extract_data')
    @patch('app.fit_parsing.fitparse_extract_data')
    @patch('os.getenv')
    def test_extract_data_to_dataframe_uses_fallback_if_env_not_set(self, mock_getenv, mock_fitparse, mock_go):
        mock_getenv.return_value = None
        mock_fitparse.return_value = pd.DataFrame()
        
        fit_parsing.extract_data_to_dataframe(b'data')
        
        mock_fitparse.assert_called_once()
        mock_go.assert_not_called()

if __name__ == '__main__':
    unittest.main()
