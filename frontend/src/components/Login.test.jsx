import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

// Mock the global fetch function
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ access_token: 'fake_token' }),
  })
);

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
  it('submits the form, gets a token, and stores it in localStorage', async () => {
    // Mock first call to /config then second to /token
    global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/config')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ external_auth_enabled: false }),
            });
        }
        if (url.includes('/token')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ access_token: 'fake_token' }),
            });
        }
        return Promise.reject(new Error(`Unhandled fetch to ${url}`));
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Wait for the initial config fetch to complete
    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    global.fetch.mockClear();

    // Find the input fields and the button
    const usernameInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Simulate user input
    fireEvent.change(usernameInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Simulate form submission
    const form = usernameInput.closest('form');
    fireEvent.submit(form);

    // Assert that the token is stored in localStorage
    await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('fake_token');
    });
  });
});