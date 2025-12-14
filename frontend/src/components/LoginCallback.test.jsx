
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginCallback from './LoginCallback';
import * as AuthContextModule from '../contexts/AuthContext';

// Mock useAuth
const mockLoginWithExternalToken = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        loginWithExternalToken: mockLoginWithExternalToken,
    }),
}));


describe('LoginCallback component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('processes access_token from hash and calls loginWithExternalToken', async () => {
        mockLoginWithExternalToken.mockResolvedValue(); // Success

        renderWithRouter('/login/callback#access_token=external_token_123');

        await waitFor(() => {
            expect(mockLoginWithExternalToken).toHaveBeenCalledWith('external_token_123');
        });

        // Assert redirect to home
        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument();
        });
    });

    it('processes token from hash (backend style) and calls loginWithExternalToken', async () => {
        mockLoginWithExternalToken.mockResolvedValue();

        renderWithRouter('/login/callback#token=external_token_456');

        await waitFor(() => {
            expect(mockLoginWithExternalToken).toHaveBeenCalledWith('external_token_456');
        });
        // Assert redirect to home
        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument();
        });
    });

    it('processes access_token from query params and calls loginWithExternalToken', async () => {
        mockLoginWithExternalToken.mockResolvedValue();

        renderWithRouter('/login/callback?access_token=external_token_789');

        await waitFor(() => {
            expect(mockLoginWithExternalToken).toHaveBeenCalledWith('external_token_789');
        });
        // Assert redirect to home
        await waitFor(() => {
            expect(screen.getByText('Home Page')).toBeInTheDocument();
        });
    });

    it('redirects to login with error if loginWithExternalToken fails', async () => {
        mockLoginWithExternalToken.mockRejectedValue(new Error('Invalid token'));

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
