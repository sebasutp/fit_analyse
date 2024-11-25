import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import msgpack from 'msgpack-lite';
import PowerCard from './power/PowerCard'
import { ElevCard } from './activity/ElevationCard';
import {Metric, MetricBox} from './MetricComponents'

function ViewActivity() {
  const { id } = useParams();
  const [activity, setActivity] = useState({});
  //const [activityRawData, setActivityRawData] = useState({});
  const [is_loading_main_activity, setIsLoadingMainActivity] = useState(true);
  //const [is_loading_raw_activity, setIsLoadingRawActivity] = useState(true);

  function getElapsedTime(seconds) {
    let x = seconds;
    const sec = x % 60;
    x -= sec;
    x = x / 60;
    const min = x % 60;
    x -= min;
    x = x / 60;
    const hours = x;
    return [
      `${hours.toString().padStart(2, '0')}`,
      `${min.toString().padStart(2, '0')}`,
      `${sec.toString().padStart(2, '0')}`].join(":")
  }

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
    /*setIsLoadingRawActivity(true);
    fetch(`${import.meta.env.VITE_BACKEND_URL}/activity/${id}/raw?columns=power`)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => {
        const decodedArray = msgpack.decode(new Uint8Array(arrayBuffer));
        console.log(decodedArray);
        setActivityRawData(decodedArray);
        setIsLoadingRawActivity(false);
      })*/
  }, [id]);

  return (
    <div>
      {(is_loading_main_activity) ? // || is_loading_raw_activity
        (
          <img src='./assets/loading.gif' alt="Loading..." />
        ) : 
        ( 
          <div className="flex flex-col items-center justify-center mt-8 px-8">
            <div className="activity-container">
              <h1 className="activity-title">{activity.activity_base.name}</h1>
              <p className="activity-date">{activity.activity_base.date}</p>
            </div>
            <div className="two-col-container">
              <Metric name="Distance" value={activity.activity_analysis.distance} unit="km" decimalPlaces={1}/>
              <Metric name="Average Speed" value={activity.activity_analysis.average_speed} unit="km/h" decimalPlaces={1}/>
              <Metric name="Elevation gain" value={activity.activity_analysis.elevation_gain} unit="m" />
              <MetricBox name="Elapsed time" value={getElapsedTime(activity.activity_analysis.total_elapsed_time)} />
            </div>
            <ElevCard elevSummary={activity.activity_analysis.elev_summary} />
            <PowerCard powerSummary={activity.activity_analysis.power_summary} />
          </div>
        )
      }
    </div>
  );
}

export default ViewActivity;