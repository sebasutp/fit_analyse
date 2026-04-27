import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityCard } from './ActivityCard';

describe('ActivityCard component', () => {
  const mockActivity = {
    activity_id: '1',
    name: 'Morning Ride',
    distance: 25.5,
    elevation_gain: 300,
    active_time: 3600,
  };

  it('renders without heart rate', () => {
    render(
      <MemoryRouter>
        <ActivityCard activity={mockActivity} />
      </MemoryRouter>
    );
    expect(screen.getByText('Morning Ride')).toBeDefined();
    expect(screen.queryByText('Avg HR')).toBeNull();
  });

  it('renders with heart rate', () => {
    const activityWithHR = { ...mockActivity, average_heartrate: 145 };
    render(
      <MemoryRouter>
        <ActivityCard activity={activityWithHR} />
      </MemoryRouter>
    );
    expect(screen.getByText('Avg HR')).toBeDefined();
    expect(screen.getByText(/145/)).toBeDefined();
    expect(screen.getByText(/bpm/)).toBeDefined();
  });

});
