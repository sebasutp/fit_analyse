import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewActivity from './NewActivity';

// Mock the global fetch function
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ activity_id: 123 }),
  })
);

describe('NewActivity component', () => {
  it('uploads a file and makes a POST request', async () => {
    render(
      <MemoryRouter>
        <NewActivity />
      </MemoryRouter>
    );

    // Find the file input
    const fileInput = screen.getByLabelText(/upload activity file/i);

    // Create a dummy file
    const file = new File(['hello'], 'hello.fit', { type: 'application/fit' });

    // Simulate a user selecting a file
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the async actions to complete
    await waitFor(() => {
      // Assert that fetch was called
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Assert that fetch was called with the correct URL and options
    const expectedUrl = `${import.meta.env.VITE_BACKEND_URL}/upload_activity`;
    const fetchCall = global.fetch.mock.calls[0];
    const fetchUrl = fetchCall[0];
    const fetchOptions = fetchCall[1];

    expect(fetchUrl).toBe(expectedUrl);
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBeInstanceOf(FormData);
    expect(fetchOptions.body.get('file')).toEqual(file);
  });
});