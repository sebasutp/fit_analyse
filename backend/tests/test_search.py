import pytest
from app.services import analysis
from app import model
from datetime import datetime

# Helper to create dummy activities
def create_activity(name, tags=None, date_str="2023-01-01"):
    return model.ActivityTable(
        activity_id="id",
        name=name,
        tags=tags,
        date=datetime.strptime(date_str, "%Y-%m-%d"),
        owner_id=1,
        activity_type="recorded",
        distance=0, active_time=0, elevation_gain=0, last_modified=datetime.utcnow(),
        data=b"", fit_file=b""
    )

# --- Unit Tests for Helpers ---

def test_calculate_term_match_exact():
    assert analysis.calculate_term_match("test", "test") == 100
    assert analysis.calculate_term_match("Test", "test") == 100 # Case insensitive

def test_calculate_term_match_partial():
    assert analysis.calculate_term_match("te", "test") == 100
    assert analysis.calculate_term_match("zer", "Zermatt") == 100

def test_calculate_term_match_fuzzy():
    # "Zermmat" vs "Zermatt" -> close enough
    # Default threshold is 75
    score = analysis.calculate_term_match("Zermmat", "Zermatt")
    assert score >= 75

def test_calculate_term_match_with_custom_threshold():
    # "apple" vs "apply" might be > 75 but maybe < 90
    # fuzz.partial_ratio("apple", "apply") -> partial match "appl" is 100? No.
    # partial_ratio of "apple" in "apply" -> "apply" contains "appl" (len 4) vs "apple" (len 5).
    # ratio is 80? (4/5 * 100)
    
    # Let's simple use "abc" vs "abd" -> ratio approx 66.
    # Threshold 50 -> Match. Threshold 80 -> No match.
    term = "abc"
    text = "abd"
    # ratio of abc vs abd is 66.6
    
    assert analysis.calculate_term_match(term, text, threshold=50) > 0
    assert analysis.calculate_term_match(term, text, threshold=90) == 0

def test_calculate_term_match_no_match():
    assert analysis.calculate_term_match("abc", "xyz") == 0

def test_score_activity_match():
    a = create_activity("Zermatt Ride", tags=["Holiday"])
    score = analysis.score_activity(a, ["zer", "holiday"])
    assert score > 0 # Should be sum of scores

def test_score_activity_partial_fail():
    a = create_activity("Zermatt Ride")
    score = analysis.score_activity(a, ["zer", "xyz"])
    assert score == 0 # "xyz" not found

# --- Integration Tests (Original) ---

def test_search_partial_match():
    a1 = create_activity("Zermatt Ride")
    a2 = create_activity("Morning Run")
    activities = [a1, a2]
    
    results = analysis.search_and_rank_activities(activities, "zer")
    assert a1 in results
    assert len(results) == 1

def test_search_case_insensitive():
    a1 = create_activity("Zermatt Ride")
    activities = [a1]
    
    results = analysis.search_and_rank_activities(activities, "zErMaTt")
    assert a1 in results

def test_search_order_independent():
    a1 = create_activity("Zermatt Ride")
    activities = [a1]
    
    results = analysis.search_and_rank_activities(activities, "ride zermatt")
    assert a1 in results

def test_search_fuzzy_match():
    a1 = create_activity("Zermatt Ride")
    activities = [a1]
    
    # "Zermmat" is a misspelling of "Zermatt"
    results = analysis.search_and_rank_activities(activities, "Zermmat")
    assert a1 in results

def test_search_tags():
    a1 = create_activity("Morning Ride", tags=["Switzerland", "Mountains"])
    a2 = create_activity("Evening Run", tags=["City"])
    activities = [a1, a2]
    
    results = analysis.search_and_rank_activities(activities, "mount")
    assert a1 in results
    assert len(results) == 1

def test_search_multi_word_partial():
    a1 = create_activity("Zermatt Holiday Ride")
    activities = [a1]
    
    results = analysis.search_and_rank_activities(activities, "zer holi")
    assert a1 in results

def test_search_no_match():
    a1 = create_activity("Zermatt Ride")
    activities = [a1]
    
    results = analysis.search_and_rank_activities(activities, "Paris")
    assert len(results) == 0
