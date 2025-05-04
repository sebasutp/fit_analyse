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
  const [hasMore, setHasMore] = useState(true); // Assume there's more data initially
  // Ensure the limit is treated as a number
  const limit = parseInt(import.meta.env.VITE_ACTIVITY_PAGE_LIMIT) || 10;

  const navigate = useNavigate();
  const token = GetToken();

  const loadActivities = useCallback((isInitialLoad = false) => {
    if (isLoading || (!isInitialLoad && !hasMore)) {
      // Don't fetch if already loading or if we know there's no more data
      return;
    }

    setIsLoading(true);
    let url = `${import.meta.env.VITE_BACKEND_URL}/activities?limit=${limit}`;

    // Add cursor parameters if it's not the initial load and cursors exist
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
      // Load initial batch of activities
      loadActivities(true);
    }
  }, [navigate, token]); // Run only when token changes or on initial mount

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
      {activities.length > 0 || !isLoading ? ( // Show content if activities exist or not loading initial batch
          <div>
            <NewActivity />
            <div className="col-container">
                {activities.map((activity, i) => (
                  <ActivityCard
                    key={i}
                    activity={activity}
                  />
                ))
                }
            </div>
            {/* Show loading indicator specifically for loading more */}
            {isLoading && activities.length > 0 && <div style={{ textAlign: 'center', margin: '20px' }}><img src={loadingImg} alt="Loading more..." /></div>}
          </div>
        ) : ( // Show initial loading indicator
          <img src={loadingImg} alt="Loading..." />
        )}
    </div>
  );
}

export default Activities;