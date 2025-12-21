import { useState, useCallback, useEffect, useRef } from 'react';
import apiClient from '../api/client';

export const useActivities = (limit = 10) => {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [selectedTab, setSelectedTab] = useState('recorded');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination state
    const [cursorDate, setCursorDate] = useState(null);
    const [cursorId, setCursorId] = useState(null);

    // Prevent double loading in strict mode during initial mount
    const isInitialLoadDone = useRef(false);

    const loadActivities = useCallback(async (isInitialLoad = false) => {
        if (isLoading) return;
        if (!isInitialLoad && !hasMore) return;

        setIsLoading(true);

        try {
            let params = {
                limit,
                activity_type: selectedTab,
            };

            if (searchQuery) {
                params.search_query = searchQuery;
            }

            if (!isInitialLoad && cursorDate && cursorId) {
                params.cursor_date = cursorDate;
                params.cursor_id = cursorId;
            }

            const response = await apiClient.get('/activities', { params });
            const newActivities = response.data;

            setActivities(prev => isInitialLoad ? newActivities : [...prev, ...newActivities]);

            if (newActivities.length > 0) {
                const lastActivity = newActivities[newActivities.length - 1];
                setCursorDate(lastActivity.date);
                setCursorId(lastActivity.activity_id);
            }

            setHasMore(newActivities.length === limit);

        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setIsLoading(false);
        }
    }, [limit, selectedTab, searchQuery, cursorDate, cursorId, isLoading, hasMore]);


    // Effect to reset and reload when filters change
    useEffect(() => {
        setActivities([]);
        setCursorDate(null);
        setCursorId(null);
        setHasMore(true);
        isInitialLoadDone.current = false;

        // We need to trigger the load. Since state updates are async, 
        // we can't just call loadActivities(true) here with stable references if they depend on the just-reset state.
        // Actually, loadActivities depends on cursorDate/Id. 
        // But for initial load (isInitialLoad=true), it IGNORES cursor params.
        // So we can call it.

        const fetchInitial = async () => {
            setIsLoading(true); // Manually set loading to prevent race conditions from other effects if any
            try {
                // Simplified fetch for initial load to avoid stale closures on cursor
                let params = {
                    limit,
                    activity_type: selectedTab,
                };
                if (searchQuery) params.search_query = searchQuery;

                const response = await apiClient.get('/activities', { params });
                const newActivities = response.data;

                setActivities(newActivities);
                if (newActivities.length > 0) {
                    const lastActivity = newActivities[newActivities.length - 1];
                    setCursorDate(lastActivity.date);
                    setCursorId(lastActivity.activity_id);
                }
                setHasMore(newActivities.length === limit);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        }

        fetchInitial();

    }, [selectedTab, searchQuery, limit]);

    return {
        activities,
        isLoading,
        hasMore,
        selectedTab,
        setSelectedTab,
        searchQuery,
        setSearchQuery,
        loadMore: () => loadActivities(false)
    };
};
