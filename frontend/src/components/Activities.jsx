import { useState, useEffect, act } from 'react';
import { useNavigate } from 'react-router-dom';
import NewActivity from './NewActivity'
import { GetToken, ParseBackendResponse } from './Utils';
import { ActivityCard } from './activity/ActivityCard';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [is_loading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const token = GetToken();
  
  const loadActivities = (token) => {
    setIsLoading(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activities/`;
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => ParseBackendResponse(response, navigate))
      .then((data) => {
        setActivities(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching activity details:', error);
      });
  }

  useEffect(() => {
    if (!token) {
      console.log("Token not found redirecting to /login");
      navigate("/login");
    } else {
      loadActivities(token)
    }
  }, [navigate]);
    
  return (
    <div>
      {is_loading ? 
        (
          <img src='/assets/loading.gif' alt="Loading..." />
        ) : 
        (
          <div>
            <NewActivity />
            <div className="flex flex-col items-center justify-center mt-24">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {activities.map((activity, i) => (
                  <ActivityCard
                    key={i}
                    activity={activity}
                  />
                ))
                }
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

export default Activities;