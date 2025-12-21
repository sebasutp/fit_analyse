import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the API client globally to avoid network requests during tests
vi.mock('../api/client', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        interceptors: {
            request: { use: vi.fn(), eject: vi.fn() },
            response: { use: vi.fn(), eject: vi.fn() }
        }
    }
}));

// Polyfill for crypto.subtle (needed for BatchUpload/SHA-256) in JSDOM
// Only if not already present (newer Node versions might have it)
if (!global.crypto) {
    global.crypto = {};
}
if (!global.crypto.subtle) {
    global.crypto.subtle = {
        digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32))) // Mock 32-byte hash
    };
}
