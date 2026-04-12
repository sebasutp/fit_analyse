import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LapsTable from './LapsTable';

describe('LapsTable component', () => {
  const mockLaps = [
    {
      lap_number: 1,
      total_distance: 1000,
      total_elapsed_time: 120,
      total_timer_time: 120,
      avg_speed: 30,
      max_speed: 40,
      avg_power: 200,
      max_power: 300,
      total_ascent: 10,
      total_descent: 5,
      power_summary: { average_power: 200, max_power: 300 }
    },
    {
      lap_number: 2,
      total_distance: 1000,
      total_elapsed_time: 120,
      total_timer_time: 120,
      avg_speed: 30,
      max_speed: 40,
      avg_power: 200,
      max_power: 300,
      total_ascent: 10,
      total_descent: 5,
      avg_heart_rate: 150,
      max_heart_rate: 170,
      power_summary: { average_power: 200, max_power: 300 }
    }
  ];

  it('renders laps table and handles laps without heart rate', () => {
    render(<LapsTable laps={mockLaps} />);
    expect(screen.getByText('Laps')).toBeDefined();
    
    // avg and max HR are shown inside the table rows conditionally
    expect(screen.getByText('Avg HR (bpm)')).toBeDefined();
    expect(screen.getByText('Max HR (bpm)')).toBeDefined();
    
    // The second lap should render "150" and "170"
    expect(screen.getByText('150')).toBeDefined();
    expect(screen.getByText('170')).toBeDefined();
  });
});
