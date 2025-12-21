import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActivity } from './useActivity';
import apiClient from '../api/client';

describe('useActivity Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches activity and power curve on mount', async () => {
        const mockActivity = { activity_base: { name: 'Test Ride' } };
        const mockPowerCurve = [{ duration: 1, max_watts: 200 }];

        apiClient.get.mockImplementation((url) => {
            if (url === '/activity/123') return Promise.resolve({ data: mockActivity });
            if (url === '/activity/123/power-curve') return Promise.resolve({ data: mockPowerCurve });
            return Promise.reject(new Error('not found'));
        });

        const { result } = renderHook(() => useActivity('123'));

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.activity).toEqual(mockActivity);
        expect(result.current.powerCurveData).toEqual(mockPowerCurve);
    });

    it('handles fetch errors', async () => {
        apiClient.get.mockRejectedValue(new Error('Fetch failed'));

        const { result } = renderHook(() => useActivity('123'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeTruthy();
    });

    it('updates activity successfully', async () => {
        const initialActivity = { activity_base: { name: 'Old Name' } };
        apiClient.get.mockResolvedValue({ data: initialActivity });
        apiClient.patch.mockResolvedValue({ data: { name: 'New Name' } });

        const { result } = renderHook(() => useActivity('123'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.updateActivity('New Name', '2023-01-01', []);
        });

        expect(apiClient.patch).toHaveBeenCalledWith('/activity/123', {
            name: 'New Name',
            date: '2023-01-01',
            tags: []
        });

        // Check if local state was updated
        expect(result.current.activity.activity_base.name).toBe('New Name');
    });

    it('deletes activity successfully', async () => {
        apiClient.get.mockResolvedValue({ data: {} });
        apiClient.delete.mockResolvedValue({ data: {} });

        const { result } = renderHook(() => useActivity('123'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.deleteActivity();
        });

        expect(apiClient.delete).toHaveBeenCalledWith('/activity/123');
    });
});
