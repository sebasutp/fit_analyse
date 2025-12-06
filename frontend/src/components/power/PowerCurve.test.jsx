import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PowerCurve from './PowerCurve';
import { vi } from 'vitest';

// Mock Chart.js to avoid canvas errors in JSDOM
vi.mock('react-chartjs-2', () => ({
    Line: () => <div data-testid="line-chart">Line Chart</div>,
}));

describe('PowerCurve component', () => {
    it('renders without crashing with valid data', () => {
        const mockData = [
            { duration: 1, max_watts: 300 },
            { duration: 60, max_watts: 200 },
        ];
        render(<PowerCurve powerCurveData={mockData} />);
        expect(screen.getByText('Power Curve')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders nothing or empty state when no data', () => {
        // Depending on implementation, might render title or not. 
        // Plan: if no data, don't crash, maybe show just title or empty.
        const { container } = render(<PowerCurve powerCurveData={[]} />);
        // For now assuming it still renders the container/title
        expect(screen.getByText('Power Curve')).toBeInTheDocument();
    });
});
