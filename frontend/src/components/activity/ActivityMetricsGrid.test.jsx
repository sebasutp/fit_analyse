import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityMetricsGrid from './ActivityMetricsGrid';

describe('ActivityMetricsGrid component', () => {
  const mockAnalysis = {
    distance: 25.5,
    average_speed: 25.5,
    elevation_gain: 300,
    total_elapsed_time: 3600,
  };

  it('renders without heart rate', () => {
    render(<ActivityMetricsGrid activityAnalysis={mockAnalysis} />);
    expect(screen.getByText('Distance')).toBeDefined();
    expect(screen.queryByText('Average HR')).toBeNull();
    expect(screen.queryByText('Max HR')).toBeNull();
  });

  it('renders with heart rate', () => {
    const analysisWithHR = { ...mockAnalysis, average_heartrate: 145, max_heartrate: 180 };
    render(<ActivityMetricsGrid activityAnalysis={analysisWithHR} />);
    expect(screen.getByText('Average HR')).toBeDefined();
    expect(screen.getByText(/145/)).toBeDefined();
    expect(screen.getAllByText(/bpm/)).toHaveLength(2);
    expect(screen.getByText('Max HR')).toBeDefined();
    expect(screen.getByText(/180/)).toBeDefined();
  });


});
