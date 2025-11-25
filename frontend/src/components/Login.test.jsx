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
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

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
      // Assert that fetch was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Assert that fetch was called with the correct URL
    expect(global.fetch).toHaveBeenCalledWith(
      `${import.meta.env.VITE_BACKEND_URL}/token`,
      expect.any(Object)
    );

    // Assert that the token is stored in localStorage
    expect(localStorage.getItem('token')).toBe('fake_token');
  });
});