import { getElapsedTime } from "../Utils";
import {Metric, MetricBox} from '../MetricComponents'


export function ActivityCard({activity}) {
    return (
      <div className="card-container">
        <a href={`./activity/${activity.activity_id}`} className="card-title">{activity.name}</a>
        <div className="row-container">
          <Metric name="Distance" value={activity.distance} unit="km" />
          <Metric name="Elev. Gain" value={activity.elevation_gain} unit="m" />
          <MetricBox name="Time" value={getElapsedTime(activity.active_time)} />
        </div>
      </div>
    );
  };