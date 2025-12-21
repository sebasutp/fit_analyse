import { describe, it, expect, vi } from 'vitest';
import apiClient from './client';

describe('API Client', () => {
    it('is mocked in test environment', () => {
        expect(vi.isMockFunction(apiClient.get)).toBe(true);
        expect(vi.isMockFunction(apiClient.post)).toBe(true);
    });
});
