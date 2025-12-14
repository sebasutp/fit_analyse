import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

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
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Login component', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('renders local login form when auth_provider is local', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/config')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ auth_provider: 'local' }),
        });
      }
      if (url.includes('/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'fake_token' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Wait for form to appear
    await waitFor(() => screen.getByLabelText(/username/i));

    // Find the input fields and the button
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Simulate user input
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Simulate form submission
    fireEvent.click(signInButton);

    // Wait for the async actions to complete
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('fake_token');
    });
  });

  it('renders external login button when auth_provider is external', async () => {
    // Mock fetch for config
    global.fetch = vi.fn((url) => {
      if (url.includes('/config')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ auth_provider: 'external' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    // Mock window.location.href
    // We can't easily mock window.location property directly in jsdom this way usually, 
    // but we can check if the button is there.
    // To test the click, we might need to delete window.location and mock it, 
    // or just checking the button existence is enough for now.

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Wait for button
    await waitFor(() => screen.getByText(/Sign in with Google/i));

    expect(screen.queryByLabelText(/username/i)).toBeNull();
    expect(screen.getByText(/Sign in with Google/i)).toBeInTheDocument();
  });
});