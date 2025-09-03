import { getElapsedTime } from "../Utils";
import {Metric, MetricBox} from '../MetricComponents'
import { useState, useEffect } from 'react';

export function ActivityCard({activity}) {
    const [mapImageUrl, setMapImageUrl] = useState(null);
    const [mapImageError, setMapImageError] = useState(false);

    const isRoute = activity.activity_type === 'route';

    useEffect(() => {
        const imageUrl = `${import.meta.env.VITE_BACKEND_URL}/activity_map/${activity.activity_id}`;
        setMapImageUrl(imageUrl);
        setMapImageError(false); // Reset error state on new activity
    }, [activity.activity_id]);

    const handleImageError = () => {
        setMapImageError(true);
    };

    return (
      <div className="card-container">
        <a href={`./activity/${activity.activity_id}`} className="card-title">
          {activity.name}
        </a>
        <div className="row-container">
          <Metric name="Distance" value={activity.distance} unit="km" />
          <Metric name="Elev. Gain" value={activity.elevation_gain} unit="m" />
          {!isRoute && (
            <MetricBox name="Time" value={getElapsedTime(activity.active_time)} />
          )}
        </div>
        {activity.tags && activity.tags.length > 0 && (
          <div style={{ marginTop: '10px', marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {activity.tags.map((tag, index) => (
              <span key={index} style={{ backgroundColor: '#e0e0e0', padding: '3px 8px', borderRadius: '12px', fontSize: '0.8em' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {mapImageError ? (
          <div className="no-map-image">
            <p>Indoor ride</p>
          </div>
        ) : (
          <a href={`./map/${activity.activity_id}`}>
            <img
              src={mapImageUrl}
              onError={handleImageError}
              alt={`Map for ${activity.name}`}
              style={{ width: "100%", height: "auto" }}
            />
          </a>
        )}
      </div>
    );
  };
