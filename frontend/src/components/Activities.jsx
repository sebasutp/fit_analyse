import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NewActivity from './NewActivity'
import { GetToken } from './Utils';
import { ActivityCard } from './activity/ActivityCard';
import ActivityFilters from './activity/ActivityFilters';
import { useActivities } from '../hooks/useActivities';
import loadingImg from '../assets/loading.gif';

function Activities() {
  const navigate = useNavigate();
  const token = GetToken();
  const limit = parseInt(import.meta.env.VITE_ACTIVITY_PAGE_LIMIT) || 10;

  const {
    activities,
    isLoading,
    hasMore,
    selectedTab,
    setSelectedTab,
    searchQuery,
    setSearchQuery,
    loadMore
  } = useActivities(limit);

  // Authentication check
  useEffect(() => {
    if (!token) {
      console.log("Token not found redirecting to /login");
      navigate("/login");
    }
  }, [token, navigate]);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100 &&
        !isLoading &&
        hasMore
      ) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, loadMore]);

  return (
    <div>
      <div className="flex justify-between items-center px-4 py-2">
        <NewActivity />
      </div>

      <ActivityFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
      />

      {activities.length > 0 || !isLoading ? (
        <div>
          <div className="col-container">
            {activities.map((activity, i) => (
              <ActivityCard
                key={`${selectedTab}-${activity.activity_id}-${i}`}
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