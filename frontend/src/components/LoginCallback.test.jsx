import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginCallback from './LoginCallback';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        clear: () => {
            store = {};
        },
        removeItem: (key) => {
            delete store[key];
        }
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('LoginCallback component', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.restoreAllMocks();
    });

    const renderWithRouter = (initialUrl) => {
        render(
            <MemoryRouter initialEntries={[initialUrl]}>
                <Routes>
                    <Route path="/login/callback" element={<LoginCallback />} />
                    <Route path="/login" element={<div>Login Page</div>} />
                    <Route path="/" element={<div>Home Page</div>} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('processes access_token from hash and calls exchange-token', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'local_jwt_token' }),
        });

        renderWithRouter('/login/callback#access_token=external_token_123');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/exchange-token'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ external_token: 'external_token_123' }),
                })
            );
        });

        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('local_jwt_token');
        });
    });

    it('processes token from hash (backend style) and calls exchange-token', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'local_jwt_token_2' }),
        });

        renderWithRouter('/login/callback#token=external_token_456');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/exchange-token'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ external_token: 'external_token_456' }),
                })
            );
        });

        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe('local_jwt_token_2');
        });
    });

    it('processes access_token from query params and calls exchange-token', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'local_jwt_token_3' }),
        });

        renderWithRouter('/login/callback?access_token=external_token_789');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/exchange-token'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ external_token: 'external_token_789' }),
                })
            );
        });
    });

    it('redirects to login with error if exchange fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Invalid token' }),
        });

        renderWithRouter('/login/callback#access_token=bad_token');

        await waitFor(() => {
            expect(screen.getByText('Login Page')).toBeInTheDocument();
        });
    });

    it('redirects to login with error if no token found', async () => {
        renderWithRouter('/login/callback'); // No params

        await waitFor(() => {
            expect(screen.getByText('Login Page')).toBeInTheDocument();
        });
    });
});
