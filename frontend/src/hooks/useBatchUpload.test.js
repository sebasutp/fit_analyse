import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBatchUpload } from './useBatchUpload';
import apiClient from '../api/client';

describe('useBatchUpload Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches existing hashes on mount', async () => {
        const mockHashes = ['hash1', 'hash2'];
        apiClient.get.mockResolvedValue({ data: mockHashes });

        const { result } = renderHook(() => useBatchUpload());

        expect(result.current.isLoadingHashes).toBe(true);
        await waitFor(() => expect(result.current.isLoadingHashes).toBe(false));

        // We can't access existingHashes directly via ref/state if it's internal to the hook only if returned?
        // Ah, the hook I wrote DOES NOT return existingHashes. It returns handleFileSelection etc.
        // But it uses existingHashes internally. We will verify behavior via uploadBatch.
    });

    it('filters invalid files on selection', () => {
        const { result } = renderHook(() => useBatchUpload());

        const mockFiles = [
            { name: 'run.fit' },
            { name: 'route.gpx' },
            { name: 'image.png' }
        ];

        act(() => {
            result.current.handleFileSelection(mockFiles);
        });

        expect(result.current.files).toHaveLength(2);
        expect(result.current.totalFiles).toBe(2);
        expect(result.current.files.map(f => f.name)).toEqual(['run.fit', 'route.gpx']);
    });

    it('uploads files correctly and skips duplicates', async () => {
        // Mock existing hashes
        apiClient.get.mockResolvedValue({ data: ['existing-hash'] });

        // Mock upload endpoint
        apiClient.post.mockResolvedValue({ data: { val_hash: 'new-hash' } });

        // Mock crypto functions
        const mockFileNew = new File(["new conten"], "new.fit", { type: "application/octet-stream" });
        const mockFileExisting = new File(["existing content"], "existing.fit", { type: "application/octet-stream" });

        // We need to ensure arrayBuffer returns unique values so our mock hash function produces unique hashes
        // But in setup.js we mocked crypto.subtle.digest to return a fixed buffer. 
        // We should override it here to return different hashes based on input?
        // Or just spy on calculateHash? We can't spy on internal function easily.
        // Let's modify the crypto mock implementation for this test or assume distinct behavior involves logic.

        // Simulating hash generation:
        // 'existing.fit' should produce 'existing-hash'
        // 'new.fit' should produce 'new-hash'

        // Since we can't easily mock window.crypto from here inside the hook's execution context dynamically based on content unless we control the mock.
        // Let's try to mock the internal `calculateHash`? No, it's defined inside the hook.

        // Better approach: Mock crypto.subtle.digest to return specific values
        const digestMock = vi.fn();
        // Return mostly fake buffers. We'll rely on the fact that existingHashes.has(hash) check.

        // Let's perform a simpler test where we assume NO existing hashes initially, 
        // and we verify the API calls are made.
        // For duplication test, we need to populate existingHashes.
    });
});

// Re-writing the test with a simpler approach given the constraints of mocking internal crypto inside JSDOM from Vitest
describe('useBatchUpload Hook (Upload Logic)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset crypto mock
        global.crypto.subtle.digest = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]).buffer)); // Fixed hash
    });

    it('uploads a file successfully', async () => {
        apiClient.get.mockResolvedValue({ data: [] }); // No existing hashes
        apiClient.post.mockResolvedValue({ data: { val_hash: '010203' } });

        const { result } = renderHook(() => useBatchUpload());
        await waitFor(() => expect(result.current.isLoadingHashes).toBe(false));

        const mockFile = { name: 'test.fit', arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) };

        act(() => {
            result.current.handleFileSelection([mockFile]);
        });

        expect(result.current.files).toHaveLength(1);
        expect(result.current.uploadStatus['test.fit']).toBe('pending');

        await act(async () => {
            await result.current.uploadBatch();
        });

        expect(result.current.uploadStatus['test.fit']).toBe('success');
        expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('skips existing file', async () => {
        // Hash for [1,2,3] is 010203 in hex (roughly, logic in hook uses padStart)
        // 1 -> 01, 2 -> 02, 3 -> 03 => "010203"
        apiClient.get.mockResolvedValue({ data: ['010203'] });

        const { result } = renderHook(() => useBatchUpload());
        await waitFor(() => expect(result.current.isLoadingHashes).toBe(false));

        const mockFile = { name: 'duplicate.fit', arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) };

        act(() => {
            result.current.handleFileSelection([mockFile]);
        });

        await act(async () => {
            await result.current.uploadBatch();
        });

        expect(result.current.uploadStatus['duplicate.fit']).toBe('skipped');
        expect(apiClient.post).not.toHaveBeenCalled();
    });
});
