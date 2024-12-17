import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PowerCard from './power/PowerCard'
import { ElevCard } from './activity/ElevationCard';
import {Metric, MetricBox} from './MetricComponents'
import {getElapsedTime} from './Utils'

function ViewActivity() {
  const { id } = useParams();
  const [activity, setActivity] = useState({});
  const [is_loading_main_activity, setIsLoadingMainActivity] = useState(true);

  useEffect(() => {
    setIsLoadingMainActivity(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setActivity(data);
        setIsLoadingMainActivity(false);
      })
      .catch((error) => {
        console.error('Error fetching main activity details:', error);
      });
  }, [id]);

  return (
    <div>
      {is_loading_main_activity ? ( // || is_loading_raw_activity
        <img src="./assets/loading.gif" alt="Loading..." />
      ) : (
        <div className="flex flex-col items-center justify-center mt-8 px-8">
          <div className="row-container">
            <div className="activity-container">
              <h1 className="activity-title">{activity.activity_base.name}</h1>
              <p className="activity-date">{activity.activity_base.date}</p>
            </div>
            <div className="two-col-container">
              <Metric
                name="Distance"
                value={activity.activity_analysis.distance}
                unit="km"
                decimalPlaces={1}
              />
              <Metric
                name="Average Speed"
                value={activity.activity_analysis.average_speed}
                unit="km/h"
                decimalPlaces={1}
              />
              <Metric
                name="Elevation gain"
                value={activity.activity_analysis.elevation_gain}
                unit="m"
              />
              <MetricBox
                name="Elapsed time"
                value={getElapsedTime(
                  activity.activity_analysis.total_elapsed_time
                )}
              />
            </div>
          </div>
          <a href={`../map/${activity.activity_base.activity_id}`}>
            <img
              src={`${import.meta.env.VITE_BACKEND_URL}/activity_map/${
                activity.activity_base.activity_id
              }`}
            />
          </a>

          {activity?.activity_analysis?.elev_summary && (
            <ElevCard elevSummary={activity.activity_analysis.elev_summary} />
          )}
          {activity?.activity_analysis?.power_summary && (
            <PowerCard
              powerSummary={activity.activity_analysis.power_summary}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default ViewActivity;