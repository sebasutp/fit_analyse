import pytest
import os
import pandas as pd
from app.fit_parsing import fitparse_extract_data, go_extract_data, extract_data_to_dataframe

from pathlib import Path

# Fixture for the path to the sample FIT file
@pytest.fixture
def sample_fit_file():
    # Calculate path relative to this test file
    # backend/tests/test_fit_parsing.py -> backend/tests/ -> backend/ -> root -> examples
    return Path(__file__).resolve().parent.parent.parent / "examples" / "2024-11-12-065535-ELEMNT ROAM 8055-155-0.fit"

# Fixture for the content of the sample FIT file
@pytest.fixture
def fit_file_content(sample_fit_file):
    with open(sample_fit_file, "rb") as f:
        return f.read()

def test_fitparse_extract_data(fit_file_content):
    df = fitparse_extract_data(fit_file_content)
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert "timestamp" in df.columns
    assert "power" in df.columns

def test_go_extract_data_no_executable():
    # Temporarily unset the environment variable
    original_value = os.environ.pop("FIT_PARSE_GO_EXECUTABLE", None)
    
    df = go_extract_data("non_existent_executable", b"dummy_data")
    assert df is None

    # Restore the environment variable
    if original_value is not None:
        os.environ["FIT_PARSE_GO_EXECUTABLE"] = original_value

def test_extract_data_to_dataframe_fitparse(fit_file_content):
    # Temporarily unset the environment variable to force fitparse
    original_value = os.environ.pop("FIT_PARSE_GO_EXECUTABLE", None)

    df = extract_data_to_dataframe(fit_file_content)
    assert isinstance(df, pd.DataFrame)
    assert not df.empty

    # Restore the environment variable
    if original_value is not None:
        os.environ["FIT_PARSE_GO_EXECUTABLE"] = original_value

def test_go_extract_data_with_executable(fit_file_content):
    go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
    if not go_executable:
        pytest.skip("FIT_PARSE_GO_EXECUTABLE not set")

    df = go_extract_data(go_executable, fit_file_content)
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert "timestamp" in df.columns
    assert "power" in df.columns

def test_extract_data_to_dataframe_go(fit_file_content):
    go_executable = os.getenv("FIT_PARSE_GO_EXECUTABLE")
    if not go_executable:
        pytest.skip("FIT_PARSE_GO_EXECUTABLE not set")

    df = extract_data_to_dataframe(fit_file_content)
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert "timestamp" in df.columns
    assert "power" in df.columns
