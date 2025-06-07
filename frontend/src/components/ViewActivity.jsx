import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { FaPencil, FaDownload, FaTrash } from "react-icons/fa6";

import PowerCard from './power/PowerCard'
import { ElevCard } from './activity/ElevationCard';
import {Metric, MetricBox} from './MetricComponents'
import LapsTable from './activity/LapsTable'; // Adjust path if necessary
import {getElapsedTime, GetToken} from './Utils';
import loadingImg from '../assets/loading.gif';

function ViewActivity() {
  const { id } = useParams();
  const [activity, setActivity] = useState({});
  const [currentActivityName, setCurrentActivityName] = useState("");
  const [currentActivityDate, setCurrentActivityDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [is_loading_main_activity, setIsLoadingMainActivity] = useState(true);
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
        setIsLoadingMainActivity(false);
      })
      .catch((error) => {
        console.error('Error fetching main activity details:', error);
      });
  }, [id]);

  const onClickEdit = () => {
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
    setEditMode(false);
  }

  const onClickSave = () => {
    setIsLoading(true);
    const url = `${import.meta.env.VITE_BACKEND_URL}/activity/${id}`;
    fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: currentActivityName,
        date: currentActivityDate
      })
    })
      .then((response) => response.json())
      .then((data) => {
        const { name, date } = data;

        setCurrentActivityName(name);
        setCurrentActivityDate(date);
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
                <div className="grid gap-6 mb-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      value={currentActivityName}
                      onChange={(e) => {
                        setCurrentActivityName(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="date"
                      className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                    >
                      Date
                    </label>
                    <input
                      type="datetime-local"
                      id="date"
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      value={currentActivityDate.slice(0, 16)}
                      onChange={(e) => {
                        setCurrentActivityDate(e.target.value);
                      }}
                    />
                  </div>
                  <button
                    className="py-2.5 px-5 me-2 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 items-center"
                    onClick={onClickCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                    onClick={onClickSave}
                    disabled={isLoading}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-4">
                    <button className="edit-button" onClick={onClickEdit}>
                      <FaPencil />
                    </button>
                    <button className="delete-button" onClick={onClickDelete} disabled={isLoading}>
                      <FaTrash />
                    </button>
                  </div>
                  <h1 className="activity-title">{currentActivityName}</h1>
                  <p className="activity-date">{currentActivityDate}</p>
                </>
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
                  src={`${import.meta.env.VITE_BACKEND_URL}/activity_map/${
                    activity.activity_base.activity_id
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
          {activity?.laps && activity.laps.length > 1 && (
            <LapsTable laps={activity.laps} />
          )}
        </div>
      )}
    </div>
  );
}

export default ViewActivity;
