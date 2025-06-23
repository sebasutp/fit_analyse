import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NewActivity from './NewActivity'
import { GetToken, ParseBackendResponse } from './Utils';
import { ActivityCard } from './activity/ActivityCard';
import loadingImg from '../assets/loading.gif';
import { db } from '../db';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cursorDate, setCursorDate] = useState(null);
  const [cursorId, setCursorId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTab, setSelectedTab] = useState('recorded'); // Default tab
  const [searchQuery, setSearchQuery] = useState(''); // Added for search
  const [isInitialDBSync, setIsInitialDBSync] = useState(false);

  const limit = parseInt(import.meta.env.VITE_ACTIVITY_PAGE_LIMIT) || 10;
  const navigate = useNavigate();
  const token = GetToken();

  // Function to load all activities for the local database cache
  const loadAllActivitiesForCache = useCallback(async () => {
    if (!token) return;
    
    setIsInitialDBSync(true);
    console.log("Starting full database synchronization...");
    
    let allActivities = [];
    let hasMoreToLoad = true;
    let tempCursorDate = null;
    let tempCursorId = null;
    
    // We don't use selectedTab or searchQuery here to get ALL activities
    let baseUrl = `${import.meta.env.VITE_BACKEND_URL}/activities?limit=50`;
    
    try {
      while (hasMoreToLoad) {
        let url = baseUrl;
        
        if (tempCursorDate && tempCursorId) {
          url += `&cursor_date=${encodeURIComponent(tempCursorDate)}&cursor_id=${encodeURIComponent(tempCursorId)}`;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const newActivities = await ParseBackendResponse(response, navigate);
        
        if (newActivities.length > 0) {
          allActivities = [...allActivities, ...newActivities];
          const lastActivity = newActivities[newActivities.length - 1];
          tempCursorDate = lastActivity.date;
          tempCursorId = lastActivity.activity_id;
          hasMoreToLoad = newActivities.length === 50; // If we got less than 50, there are no more
        } else {
          hasMoreToLoad = false;
        }
      }
      
      // Update existing records or create new ones, but don't remove any data
      await db.activities.bulkPut(allActivities);
      console.log(`Synchronization completed: ${allActivities.length} activities updated in IndexedDB`);
    } catch (error) {
      console.error("Error during full synchronization:", error);
    }
    
    setIsInitialDBSync(false);
  }, [token, navigate]);

  // loadActivities will load from indexed database if we are syncing
  const loadActivities = useCallback((isInitialLoad = false) => {
    if (isLoading || (!isInitialLoad && !hasMore)) {
      return;
    }

    setIsLoading(true);

    // If we're syncing the database or if it's a pagination load, try to load from IndexedDB
    if (isInitialDBSync || !isInitialLoad) {
      try {
        (async () => {
          let localActivities;
          
          if (selectedTab === 'recorded' || selectedTab === 'route') {
            // Filter by activity type
            localActivities = await db.activities
              .filter(activity => activity.activity_type === selectedTab)
              .toArray();
          } else {
            localActivities = await db.activities.toArray();
          }
          
          // Filter by search if needed
          if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            localActivities = localActivities.filter(activity => 
              (activity.title && activity.title.toLowerCase().includes(query)) ||
              (activity.tags && activity.tags.some(tag => tag.toLowerCase().includes(query)))
            );
          }
          
          // Sort by date (most recent first)
          localActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Apply pagination
          if (!isInitialLoad && cursorDate && cursorId) {
            const cursorIndex = localActivities.findIndex(
              a => a.date === cursorDate && a.activity_id === cursorId
            );
            if (cursorIndex !== -1 && cursorIndex + 1 < localActivities.length) {
              localActivities = localActivities.slice(cursorIndex + 1, cursorIndex + 1 + limit);
            } else {
              localActivities = [];
            }
          } else {
            // First page
            localActivities = localActivities.slice(0, limit);
          }
          
          if (isInitialLoad) {
            setActivities(localActivities);
          } else {
            setActivities(prevActivities => [...prevActivities, ...localActivities]);
          }
          
          if (localActivities.length > 0) {
            const lastActivity = localActivities[localActivities.length - 1];
            setCursorDate(lastActivity.date);
            setCursorId(lastActivity.activity_id);
          }
          
          setHasMore(localActivities.length === limit);
          setIsLoading(false);
        })();
        return; // Exit to avoid calling the API
      } catch (dbError) {
        console.error('Error loading from IndexedDB:', dbError);
        // If it fails, continue with the API call
      }
    }
    
    // If we're not syncing or loading from IndexedDB failed, call the API
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
      .then(async newActivities => {
        setActivities(prevActivities => isInitialLoad ? newActivities : [...prevActivities, ...newActivities]);

        // Update IndexedDB with new activities - only update matching records or create new ones
        try {
          if (newActivities.length > 0) {
            await db.activities.bulkPut(newActivities);
            console.log(`${newActivities.length} activities updated/added to IndexedDB`);
          }
        } catch (dbError) {
          console.error('Error updating IndexedDB:', dbError);
        }

        if (newActivities.length > 0) {
          const lastActivity = newActivities[newActivities.length - 1];
          setCursorDate(lastActivity.date);
          setCursorId(lastActivity.activity_id);
        }
        setHasMore(newActivities.length === limit);
        setIsLoading(false);
      })
      .catch(async (error) => {
        console.error('Error fetching activity details:', error);

        try {
          const localActivities = await db.activities.toArray();
          setActivities(localActivities);
          setHasMore(false);
        } catch (dbError) {
          console.error('Error loading activities from IndexedDB:', dbError);
        }
        setIsLoading(false);
      });
  }, [token, navigate, isLoading, hasMore, cursorDate, cursorId, limit, selectedTab, searchQuery, isInitialDBSync]); // Added isInitialDBSync

  // This useEffect handles the complete synchronization of the database
  useEffect(() => {
    if (token) {
      loadAllActivitiesForCache();
    }
  }, [token, loadAllActivitiesForCache]);

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
  }, [navigate, token, selectedTab, searchQuery]); // loadActivities is not in this dep array for performance reasons

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
      {isInitialDBSync && (
        <div style={{ textAlign: 'center', margin: '10px', padding: '5px', backgroundColor: '#f0f8ff', borderRadius: '5px' }}>
          <img src={loadingImg} alt="Synchronizing..." style={{ width: '20px', marginRight: '10px' }} />
          Synchronizing local database...
        </div>
      )}
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