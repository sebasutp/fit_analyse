import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaDownload } from "react-icons/fa6";

import PowerCard from './power/PowerCard'
import PowerCurve from './power/PowerCurve';
import { PowerZonesChart } from './activity/PowerZonesChart';
import { ElevCard } from './activity/ElevationCard';
import LapsTable from './activity/LapsTable';
import ActivityHeader from './activity/ActivityHeader';
import ActivityEditForm from './activity/ActivityEditForm';
import ActivityMetricsGrid from './activity/ActivityMetricsGrid';
import { useActivity } from '../hooks/useActivity';
import loadingImg from '../assets/loading.gif';

function ViewActivity() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    activity,
    powerCurveData,
    isLoading,
    isSaving,
    updateActivity,
    deleteActivity
  } = useActivity(id);

  const [editMode, setEditMode] = useState(false);

  // Local state for the edit form, initialized from activity data
  const [currentActivityName, setCurrentActivityName] = useState("");
  const [currentActivityDate, setCurrentActivityDate] = useState("");
  const [currentActivityTags, setCurrentActivityTags] = useState("");

  // Sync local edit state when activity loads
  useEffect(() => {
    if (activity?.activity_base) {
      setCurrentActivityName(activity.activity_base.name || "");
      setCurrentActivityDate(activity.activity_base.date || "");
      setCurrentActivityTags(activity.activity_base.tags ? activity.activity_base.tags.join(", ") : "");
    }
  }, [activity]);

  const onClickEdit = () => {
    setEditMode(true);
  }

  const onClickDelete = async () => {
    try {
      await deleteActivity();
      navigate("/");
    } catch (error) {
      // Error is logged in hook
    }
  }

  const onClickCancel = () => {
    // Reset to current activity values
    if (activity?.activity_base) {
      setCurrentActivityName(activity.activity_base.name || "");
      setCurrentActivityDate(activity.activity_base.date || "");
      setCurrentActivityTags(activity.activity_base.tags ? activity.activity_base.tags.join(", ") : "");
    }
    setEditMode(false);
  }

  const onClickSave = async (newName, newDate, newTagsStr) => {
    const tagsArray = newTagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
    try {
      await updateActivity(newName, newDate, tagsArray);
      setEditMode(false);
    } catch (error) {
      // Error handling if needed, hook logs it
    }
  }

  if (isLoading) {
    return <div className="flex justify-center mt-10"><img src={loadingImg} alt="Loading..." /></div>;
  }

  return (
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
              isLoading={isSaving}
            />
          ) : (
            <ActivityHeader
              name={activity?.activity_base?.name}
              date={activity?.activity_base?.date}
              tags={activity?.activity_base?.tags || []}
              onEdit={onClickEdit}
              onDelete={onClickDelete}
              isLoading={isSaving}
            />
          )}
        </div>

        <ActivityMetricsGrid activityAnalysis={activity?.activity_analysis} />
      </div>

      {activity?.has_gps_data && (
        <div>
          <a href={`../map/${activity.activity_base.activity_id}`}>
            <img
              src={`${import.meta.env.VITE_BACKEND_URL}/activity_map/${activity.activity_base.activity_id}`}
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
  );
}

export default ViewActivity;
