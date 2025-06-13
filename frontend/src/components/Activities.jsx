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
  const [searchQuery, setSearchQuery] = useState(''); // Added for search

  const limit = parseInt(import.meta.env.VITE_ACTIVITY_PAGE_LIMIT) || 10;
  const navigate = useNavigate();
  const token = GetToken();

  // loadActivities will now use selectedTab and searchQuery from state directly
  const loadActivities = useCallback((isInitialLoad = false) => {
    if (isLoading || (!isInitialLoad && !hasMore)) {
      return;
    }

    setIsLoading(true);
    // Use selectedTab and searchQuery from state
    let url = `${import.meta.env.VITE_BACKEND_URL}/activities?limit=${limit}&activity_type=${selectedTab}`;

    if (searchQuery) {
      url += `&search_query=${encodeURIComponent(searchQuery)}`;
    }

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
  }, [token, navigate, isLoading, hasMore, cursorDate, cursorId, limit, selectedTab, searchQuery]); // Added selectedTab and searchQuery

  // This useEffect handles initial load and changes to token, selectedTab, or searchQuery
  useEffect(() => {
    if (!token) {
      console.log("Token not found redirecting to /login");
      navigate("/login");
    } else {
      setActivities([]);
      setCursorDate(null);
      setCursorId(null);
      setHasMore(true);
      loadActivities(true); // loadActivities will use selectedTab and searchQuery from state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, token, selectedTab, searchQuery]); // loadActivities is not in this dep array.

  // Effect for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolling near the bottom, not already loading, and there's more data
      if (
        window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100 && // 100px buffer
        !isLoading &&
        hasMore
      ) {
        loadActivities(false); // Pass false for non-initial load
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Cleanup function to remove the event listener when the component unmounts
    return () => window.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasMore, loadActivities]); // loadActivities is a dependency here.

  return (
    <div>
      <NewActivity />
      {/* Search Input */}
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <input
          type="text"
          placeholder="Search by title or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '10px', width: '300px' }}
        />
      </div>
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