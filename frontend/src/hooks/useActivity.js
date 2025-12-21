import { useState, useCallback, useEffect } from 'react';
import apiClient from '../api/client';

export const useActivity = (activityId) => {
    const [activity, setActivity] = useState({});
    const [powerCurveData, setPowerCurveData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const fetchActivity = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get(`/activity/${activityId}`);
            setActivity(response.data);
        } catch (err) {
            console.error('Error fetching activity:', err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [activityId]);

    const fetchPowerCurve = useCallback(async () => {
        try {
            const response = await apiClient.get(`/activity/${activityId}/power-curve`);
            setPowerCurveData(response.data);
        } catch (err) {
            console.error('Error fetching power curve:', err);
            setPowerCurveData([]);
        }
    }, [activityId]);

    useEffect(() => {
        if (activityId) {
            fetchActivity();
            fetchPowerCurve();
        }
    }, [activityId, fetchActivity, fetchPowerCurve]);

    const updateActivity = async (name, date, tags) => {
        setIsSaving(true);
        try {
            const response = await apiClient.patch(`/activity/${activityId}`, {
                name,
                date,
                tags
            });
            // Update local state with the returned data
            const updatedData = response.data;
            setActivity(prev => ({
                ...prev,
                activity_base: {
                    ...prev.activity_base,
                    name: updatedData.name || updatedData.activity_base?.name,
                    date: updatedData.date || updatedData.activity_base?.date,
                    tags: updatedData.tags || updatedData.activity_base?.tags
                }
            }));
            return updatedData;
        } catch (err) {
            console.error('Error updating activity:', err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    const deleteActivity = async () => {
        setIsSaving(true);
        try {
            await apiClient.delete(`/activity/${activityId}`);
        } catch (err) {
            console.error('Error deleting activity:', err);
            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    return {
        activity,
        powerCurveData,
        isLoading,
        isSaving,
        error,
        updateActivity,
        deleteActivity,
        refetch: fetchActivity
    };
};
