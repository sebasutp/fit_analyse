"""Fit parsing utilities."""

import fitparse
import os

import subprocess
import sys
import pandas as pd
import pyarrow.ipc as pa_ipc
import time
import io  # Needed for BytesIO
import numpy as np

# Import absl libraries
from absl import logging


def fitparse_extract_data(stream: bytes):
    fitfile = fitparse.FitFile(stream)
    data = []

    for record in fitfile.messages:
        if record.name == 'record':
            row_data = {}
            for field in record.fields:
                row_data[field.name] = field.value
            data.append(row_data)

    df = pd.DataFrame(data)
    if 'position_lat' in df.columns and 'position_long' in df.columns:    
        position_scale = (1 << 32) / 360.0
        df['position_lat'] = df['position_lat'] / position_scale
        df['position_long'] = df['position_long'] / position_scale
    return df


def go_extract_data(go_program_path: str, fit_file_content: bytes, extraction_type: str = "records"):
    """
    Executes a Go program, passes FIT file content via stdin,
    and reads an Arrow stream from stdout into a Pandas DataFrame.

    Args:
        go_program_path (str): The path to the compiled Go executable.
        fit_file_content (bytes): The binary content of the FIT file.

    Returns:
        pandas.DataFrame: The DataFrame read from the Arrow stream, or None on error.
    """
    try:
        logging.info(f"Running Go executable: {go_program_path}")
        # Use subprocess.Popen to run the Go program
        # Capture stdout, stderr, and provide stdin
        process = subprocess.Popen(
            [go_program_path, f"-type={extraction_type}"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            # text=False is default, but explicitly stating it can be clearer for binary data
        )

        # Send the FIT file content to the Go process's stdin
        # and get stdout/stderr data. communicate() waits for process termination.
        stdout_data, stderr_data = process.communicate(input=fit_file_content)

        # Decode stderr for potential error messages
        stderr_output = stderr_data.decode('utf-8', errors='replace') # Use replace for safety

        if process.returncode != 0:
            logging.error(f"Go process exited with error code {process.returncode}")
            logging.error(f"Go stderr:\n{stderr_output}")
            return None
        elif stderr_output: # Log stderr even on success if it's not empty
             logging.warning(f"Go process stderr (return code 0):\n{stderr_output}")


        # Read the binary Arrow stream from the captured stdout_data
        # Use io.BytesIO to treat the bytes buffer like a file
        with io.BytesIO(stdout_data) as buffer:
            with pa_ipc.open_stream(buffer) as reader:
                # Read all records (batches) into a single PyArrow table
                arrow_table = reader.read_all()

        # Convert the PyArrow table to a Pandas DataFrame
        df = arrow_table.to_pandas()
        scales = {
            'position_lat': (1 << 32) / 360.0, 'position_long': (1 << 32) / 360.0,
            'distance': 100.0, 'total_distance': 100.0,
            'speed': 1000.0, 'avg_speed': 1000.0/3.6, 'max_speed': 1000.0/3.6,
            'total_elapsed_time': 1000.0, 'total_timer_time': 1000.0,
            'power': 1.0, 'temperature': 1.0, 'altitude': 5.0}
        bias = {'altitude': -500.0}
        for col in df.columns:
            if col not in scales:
                continue
            my_type = df[col].dtype
            missing_val = np.iinfo(my_type).max
            is_missing = df[col] == missing_val
            df[col] = df[col] / scales[col]
            if col in bias:
                df[col] += bias[col]
            df.loc[is_missing, col] = np.nan

        return df

    except FileNotFoundError:
        logging.error(f"Error: Go executable not found at {go_program_path}")
        return None
    except pa_ipc.ArrowInvalid as e:
         logging.error(f"Error reading Arrow stream from Go process: {e}")
         logging.error(f"Go process return code: {process.returncode}")
         logging.error(f"Go stderr:\n{stderr_output}")
         # Optionally log some of the stdout data if it helps debugging
         # logging.error(f"First 100 bytes of stdout: {stdout_data[:100]}")
         return None
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        # Include stderr if available from the process object
        try:
            if 'process' in locals() and hasattr(process, 'returncode'):
                 logging.error(f"Go process return code: {process.returncode}")
                 stderr_output = stderr_data.decode('utf-8', errors='replace') if 'stderr_data' in locals() else "stderr not captured"
                 logging.error(f"Go stderr:\n{stderr_output}")
        except Exception as inner_e:
            logging.error(f"Error retrieving process details: {inner_e}")
        return None


def go_extract_laps_data(go_program_path: str, fit_file_content: bytes) -> pd.DataFrame | None:
    """
    Extracts laps data from a FIT file using the Go program.

    Args:
        go_program_path (str): The path to the compiled Go executable.
        fit_file_content (bytes): The binary content of the FIT file.

    Returns:
        pandas.DataFrame: The DataFrame containing laps data, or None on error.
    """
    return go_extract_data(go_program_path, fit_file_content, extraction_type="laps")


def extract_data_to_dataframe(fitfile: bytes):
    go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
    if go_executable:
        t1 = time.time()
        df = go_extract_data(go_executable, fitfile)
        t2 = time.time()
        logging.info(f"Elapsed time for Go processing and Arrow reading: {t2-t1:.4f} seconds")
        return df
    else:
        t1 = time.time()
        df = fitparse_extract_data(fitfile)
        t2 = time.time()
        logging.info(f"Elapsed time for fitparse: {t2-t1:.4f} seconds")
        return df
