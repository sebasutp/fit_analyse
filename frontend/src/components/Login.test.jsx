import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as AuthContextModule from '../contexts/AuthContext';

// Mocks for useAuth
const mockLogin = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));


describe('Login component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock return
    mockUseAuth.mockReturnValue({
      authProviderConfig: 'loading',
      login: mockLogin,
      isLoading: false
    });
  });

  it('renders local login form when auth_provider is local', async () => {
    mockUseAuth.mockReturnValue({
      authProviderConfig: 'local',
      login: mockLogin,
      isLoading: false
    });

    // Mock fetch for local login call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fake_token' }),
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('fake_token');
    });
  });

  it('renders external login button when auth_provider is external', async () => {
    mockUseAuth.mockReturnValue({
      authProviderConfig: 'external',
      login: mockLogin,
      isLoading: false
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText(/Go to Login Page/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/username/i)).toBeNull();
  });
});