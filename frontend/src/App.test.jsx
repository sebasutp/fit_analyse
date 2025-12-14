import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock child components that might cause issues in a shallow/smoke test
// especially those using canvas or window objects not fully present in jsdom
vi.mock('./components/RouteMap', () => ({
    default: () => <div data-testid="mock-route-map">RouteMap</div>
}));
vi.mock('react-chartjs-2', () => ({
    Line: () => null,
    Bar: () => null
}));

// Mock config fetch
global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ auth_provider: 'local' }),
    })
);


describe('App Component Smoke Test', () => {
    it('renders without crashing', () => {
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );
        // If it crashes, this line is never reached.
        // We can also check for a basic element like the NavMenu
        // Assuming NavMenu renders something identifiable or we can check for text.
        // For now, just rendering successfully is the main goal.
        expect(document.body).toBeDefined();
    });
});
