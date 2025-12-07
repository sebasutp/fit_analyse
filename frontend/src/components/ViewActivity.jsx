import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { FaDownload } from "react-icons/fa6";

import PowerCard from './power/PowerCard'
import PowerCurve from './power/PowerCurve';
import { PowerZonesChart } from './activity/PowerZonesChart';
import { ElevCard } from './activity/ElevationCard';
import { Metric, MetricBox } from './MetricComponents'
import LapsTable from './activity/LapsTable'; // Adjust path if necessary
import ActivityHeader from './activity/ActivityHeader';
import ActivityEditForm from './activity/ActivityEditForm';
import { getElapsedTime, GetToken } from './Utils';
import loadingImg from '../assets/loading.gif';

function ViewActivity() {
  const { id } = useParams();
  const [activity, setActivity] = useState({});
  const [currentActivityName, setCurrentActivityName] = useState("");
  const [currentActivityDate, setCurrentActivityDate] = useState("");
  const [currentActivityTags, setCurrentActivityTags] = useState(""); // Added for tags
  const [isLoading, setIsLoading] = useState(false);
  const [is_loading_main_activity, setIsLoadingMainActivity] = useState(true);
  const [powerCurveData, setPowerCurveData] = useState([]);
  const [editMode, setEditMode] = useState(false);

  const token = GetToken();
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoadingMainActivity(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setActivity(data);
        setCurrentActivityName(data?.activity_base?.name || "");
        setCurrentActivityDate(data?.activity_base?.date || "");
        setCurrentActivityTags(data?.activity_base?.tags ? data.activity_base.tags.join(", ") : ""); // Initialize tags
        setIsLoadingMainActivity(false);
      })
      .catch((error) => {
        console.error('Error fetching main activity details:', error);
      });

    const powerCurveUrl = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}/power-curve`;
    fetch(powerCurveUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => {
        if (response.ok) return response.json();
        return [];
      })
      .then((data) => {
        setPowerCurveData(data);
      })
      .catch((error) => {
        console.error('Error fetching power curve:', error);
      });
  }, [id]);

  const onClickEdit = () => {
    setCurrentActivityName(activity?.activity_base?.name || "");
    setCurrentActivityDate(activity?.activity_base?.date || "");
    setCurrentActivityTags(activity?.activity_base?.tags ? activity.activity_base.tags.join(", ") : "");
    setEditMode(true);
  }

  const onClickDelete = () => {
    setIsLoading(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}`;
    // Call delete activity endpoint
    fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (response.ok) {
          setIsLoading(false);
          navigate("/");
        }
      })
      .catch((error) => {
        console.error("Error deleting the activity:", error);
      });
    setIsLoading(false);
  }

  const onClickCancel = () => {
    setCurrentActivityName(activity?.activity_base?.name || "");
    setCurrentActivityDate(activity?.activity_base?.date || "");
    setCurrentActivityTags(activity?.activity_base?.tags ? activity.activity_base.tags.join(", ") : ""); // Reset tags on cancel
    setEditMode(false);
  }

  const onClickSave = (newName, newDate, newTagsStr) => {
    setIsLoading(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}`;
    const tagsArray = newTagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== "");

    fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: newName,
        date: newDate,
        tags: tagsArray // Add tags to request
      })
    })
      .then((response) => response.json())
      .then((data) => {
        // Assuming backend returns the full updated activity_base or at least name, date, tags
        const updatedName = data.name || (data.activity_base && data.activity_base.name) || "";
        const updatedDate = data.date || (data.activity_base && data.activity_base.date) || "";
        const updatedTags = data.tags || (data.activity_base && data.activity_base.tags) || [];

        setCurrentActivityName(updatedName);
        setCurrentActivityDate(updatedDate);
        setCurrentActivityTags(updatedTags.join(", "));

        // Update the main activity state to reflect changes immediately
        setActivity(prevActivity => ({
          ...prevActivity,
          activity_base: {
            ...prevActivity.activity_base,
            name: updatedName,
            date: updatedDate,
            tags: updatedTags
          }
        }));
      })
      .catch((error) => {
        console.error("Error updating the activity details:", error);
      });

    setIsLoading(false);
    setEditMode(false);
  }

  return (
    <div>
      {is_loading_main_activity ? ( // || is_loading_raw_activity
        <img src={loadingImg} alt="Loading..." />
      ) : (
        <div className="flex flex-col items-center justify-center mt-8 px-8">
          <div className="row-container">
            <div className="activity-container">
              {editMode ? (
                <ActivityEditForm
                  initialName={currentActivityName}
                  initialDate={currentActivityDate}
                  initialTags={currentActivityTags}
                  onSave={onClickSave}
                  onCancel={onClickCancel}
                  isLoading={isLoading}
                />
              ) : (
                <ActivityHeader
                  name={currentActivityName}
                  date={currentActivityDate}
                  tags={activity.activity_base && activity.activity_base.tags ? activity.activity_base.tags : []}
                  onEdit={onClickEdit}
                  onDelete={onClickDelete}
                  isLoading={isLoading}
                />
              )}
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
          {activity?.has_gps_data && (
            <div>
              <a href={`../map/${activity.activity_base.activity_id}`}>
                <img
                  src={`${import.meta.env.VITE_BACKEND_URL}/activity_map/${activity.activity_base.activity_id
                    }`}
                  alt="Activity Map"
                />
              </a>
              <div className="flex flex-row items-center">
                GPX File:
                <a
                  href={`${import.meta.env.VITE_BACKEND_URL}/activity/${id}/gpx`}
                  className="download-button"
                  download
                >
                  <FaDownload />
                </a>
              </div>
            </div>
          )}

          {activity?.activity_analysis?.elev_summary && (
            <ElevCard elevSummary={activity.activity_analysis.elev_summary} />
          )}
          {activity?.activity_analysis?.power_summary && (
            <PowerCard
              powerSummary={activity.activity_analysis.power_summary}
            />
          )}
          {powerCurveData && powerCurveData.length > 0 && (
            <PowerCurve powerCurveData={powerCurveData} />
          )}
          {activity?.activity_analysis?.time_in_zones && (
            <div className="w-full max-w-4xl mt-6 p-4 bg-white rounded-lg shadow dark:bg-gray-800">
              <PowerZonesChart timeInZones={activity.activity_analysis.time_in_zones} />
            </div>
          )}
          {activity?.laps && activity.laps.length > 1 && (
            <LapsTable laps={activity.laps} />
          )}
        </div>
      )}
    </div>
  );
}

export default ViewActivity;
