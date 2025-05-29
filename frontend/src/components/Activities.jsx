import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NewActivity from './NewActivity'
import { GetToken, ParseBackendResponse } from './Utils';
import { ActivityCard } from './activity/ActivityCard';
import loadingImg from '../assets/loading.gif';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cursorDate, setCursorDate] = useState(null);
  const [cursorId, setCursorId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTab, setSelectedTab] = useState('recorded'); // Default tab

  const limit = parseInt(import.meta.env.VITE_ACTIVITY_PAGE_LIMIT) || 10;
  const navigate = useNavigate();
  const token = GetToken();

  const loadActivities = useCallback((isInitialLoad = false, tab = selectedTab) => {
    if (isLoading || (!isInitialLoad && !hasMore)) {
      return;
    }

    setIsLoading(true);
    let url = `${import.meta.env.VITE_BACKEND_URL}/activities?limit=${limit}&activity_type=${tab}`;

    if (!isInitialLoad && cursorDate && cursorId) {
      url += `&cursor_date=${encodeURIComponent(cursorDate)}&cursor_id=${encodeURIComponent(cursorId)}`;
    }

    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(response => ParseBackendResponse(response, navigate))
      .then(newActivities => {
        setActivities(prevActivities => isInitialLoad ? newActivities : [...prevActivities, ...newActivities]);

        if (newActivities.length > 0) {
          const lastActivity = newActivities[newActivities.length - 1];
          setCursorDate(lastActivity.date);
          setCursorId(lastActivity.activity_id);
        }
        setHasMore(newActivities.length === limit); // If we got less than limit, there's no more
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching activity details:', error);
        setIsLoading(false); // Ensure loading state is reset on error
      });
  }, [token, navigate, isLoading, hasMore, cursorDate, cursorId, limit]); // Add dependencies

  useEffect(() => {
    if (!token) {
      console.log("Token not found redirecting to /login");
      navigate("/login");
    } else {
      // Initial load or tab change
      setActivities([]); // Clear activities
      setCursorDate(null); // Reset cursor
      setCursorId(null);   // Reset cursor
      setHasMore(true);    // Assume more data for the new tab
      loadActivities(true, selectedTab); // Pass selectedTab
    }
  }, [navigate, token, selectedTab]); // Re-run when selectedTab changes

  // Effect for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolling near the bottom, not already loading, and there's more data
      if (
        window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100 && // 100px buffer
        !isLoading &&
        hasMore
      ) {
        loadActivities();
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Cleanup function to remove the event listener when the component unmounts
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, loadActivities]); // Re-run effect if these dependencies change

  return (
    <div>
      <NewActivity />
      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <button
          onClick={() => setSelectedTab('recorded')}
          style={{ marginRight: '10px', padding: '10px', cursor: 'pointer', backgroundColor: selectedTab === 'recorded' ? 'lightblue' : 'white' }}
        >
          Recorded Activities
        </button>
        <button
          onClick={() => setSelectedTab('route')}
          style={{ padding: '10px', cursor: 'pointer', backgroundColor: selectedTab === 'route' ? 'lightblue' : 'white' }}
        >
          Routes
        </button>
      </div>

      {activities.length > 0 || !isLoading ? (
        <div>
          <div className="col-container">
            {activities.map((activity, i) => (
              <ActivityCard
                key={`${selectedTab}-${activity.activity_id}-${i}`} // Ensure unique key on tab change
                activity={activity}
              />
            ))}
          </div>
          {isLoading && activities.length > 0 && (
            <div style={{ textAlign: 'center', margin: '20px' }}>
              <img src={loadingImg} alt="Loading more..." />
            </div>
          )}
          {!hasMore && activities.length > 0 && (
            <div style={{ textAlign: 'center', margin: '20px', color: 'gray' }}>
              No more activities to load.
            </div>
          )}
        </div>
      ) : (
        isLoading && <img src={loadingImg} alt="Loading..." /> 
      )}
       {!isLoading && activities.length === 0 && !hasMore && (
         <div style={{ textAlign: 'center', margin: '20px', color: 'gray' }}>
            No activities found for this type.
          </div>
       )}
    </div>
  );
}

export default Activities;