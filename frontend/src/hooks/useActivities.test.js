import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActivities } from './useActivities';
import apiClient from '../api/client';

describe('useActivities Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches activities on mount', async () => {
        const mockActivities = [{ activity_id: '1', name: 'Run 1', date: '2023-01-01' }];
        apiClient.get.mockResolvedValue({ data: mockActivities });

        const { result } = renderHook(() => useActivities(10));

        // Initial state
        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.activities).toEqual(mockActivities);
        expect(apiClient.get).toHaveBeenCalledWith('/activities', {
            params: { limit: 10, activity_type: 'recorded' }
        });
    });

    it('loads more activities when loadMore is called', async () => {
        const page1 = [{ activity_id: '1', name: 'Run 1', date: '2023-01-02' }];
        const page2 = [{ activity_id: '2', name: 'Run 2', date: '2023-01-01' }];

        // Mock sequential calls
        apiClient.get
            .mockResolvedValueOnce({ data: page1 })
            .mockResolvedValueOnce({ data: page2 });

        const { result } = renderHook(() => useActivities(1)); // Limit 1 to force hasMore=true

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.activities).toEqual(page1);

        await act(async () => {
            result.current.loadMore();
        });

        await waitFor(() => expect(result.current.activities).toHaveLength(2));
        expect(result.current.activities).toEqual([...page1, ...page2]);
    });

    it('resets and reloads when tab changes', async () => {
        const recordedObj = [{ activity_id: '1', activity_type: 'recorded' }];
        const routeObj = [{ activity_id: '2', activity_type: 'route' }];

        apiClient.get
            // Initial load (default 'recorded')
            .mockResolvedValueOnce({ data: recordedObj })
            // Second load (change to 'route')
            .mockResolvedValueOnce({ data: routeObj });

        const { result } = renderHook(() => useActivities(10));
        await waitFor(() => expect(result.current.activities).toEqual(recordedObj));

        await act(async () => {
            result.current.setSelectedTab('route');
        });

        // Should trigger use effect to reload
        await waitFor(() => expect(result.current.activities).toEqual(routeObj));

        expect(apiClient.get).toHaveBeenLastCalledWith('/activities', {
            params: expect.objectContaining({ activity_type: 'route' })
        });
    });

    it('resets and reloads when search query changes', async () => {
        const searchResults = [{ activity_id: '3', name: 'Search Result' }];
        apiClient.get.mockResolvedValue({ data: searchResults });

        const { result } = renderHook(() => useActivities(10));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            result.current.setSearchQuery('test');
        });

        await waitFor(() => expect(result.current.activities).toEqual(searchResults));

        expect(apiClient.get).toHaveBeenLastCalledWith('/activities', {
            params: expect.objectContaining({ search_query: 'test' })
        });
    });
});
