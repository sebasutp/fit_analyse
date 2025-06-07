// frontend/src/components/activity/LapsTable.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LapsTable from './LapsTable.jsx';

// Mock PowerCdfPlot
vi.mock('../power/PowerCdfPlot.jsx', () => ({
  default: vi.fn(() => <div data-testid="power-cdf-plot-mock">Mocked PowerCdfPlot</div>),
}));

// Mock MetricComponents
vi.mock('../MetricComponents.jsx', () => ({
  Metric: vi.fn(({ label, value, unit }) => (
    <div data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}:</span>
      <span>{value}</span>
      <span>{unit}</span>
    </div>
  )),
}));

const mockLaps = [
  { // Lap 0: Full power data
    timestamp: '2023-10-26T10:00:00Z',
    start_time: '2023-10-26T09:55:00Z',
    total_distance: 1000, // 1 km
    total_elapsed_time: 300, // 5 mins
    total_timer_time: 290, // 4 mins 50 secs
    avg_speed: 12, // km/h
    max_speed: 20,
    power_summary: {
      average_power: 150,
      median_power: 145,
      quantiles: { '0': 50, '25': 100, '50': 145, '75': 180, '100': 250 },
    },
    total_ascent: 10,
    total_descent: 5,
    some_other_main_column_data: 'Visible Data 1', // Example for visible column
  },
  { // Lap 1: No power summary
    timestamp: '2023-10-26T10:05:00Z',
    start_time: '2023-10-26T10:00:00Z',
    total_distance: 1200,
    total_elapsed_time: 360,
    total_timer_time: 350,
    avg_speed: 11,
    max_speed: 19,
    power_summary: null,
    max_power: 100, // Available as top-level
    total_ascent: 12,
    total_descent: 6,
    some_other_main_column_data: 'Visible Data 2',
  },
  { // Lap 2: Power summary but no quantiles
    timestamp: '2023-10-26T10:10:00Z',
    start_time: '2023-10-26T10:05:00Z',
    total_distance: 1100,
    total_elapsed_time: 330,
    total_timer_time: 320,
    avg_speed: 13,
    max_speed: 22,
    power_summary: {
      average_power: 160, // This would be shown in main table, but not in expanded power section
      median_power: 155, // This should be shown in fallback
    },
    max_power: 230, // This should be shown in fallback
    total_ascent: 15,
    total_descent: 7,
    some_other_main_column_data: 'Visible Data 3',
  },
    { // Lap 3: Another lap for multi-expansion tests (similar to lap 1 for simplicity)
    timestamp: '2023-10-26T10:15:00Z',
    start_time: '2023-10-26T10:10:00Z',
    total_distance: 900,
    total_elapsed_time: 270,
    total_timer_time: 260,
    avg_speed: 10,
    max_speed: 18,
    power_summary: null,
    max_power: 90,
    total_ascent: 8,
    total_descent: 4,
    some_other_main_column_data: 'Visible Data 4',
  }
];

// Helper to format duration for assertions (must match component's format)
const formatDuration = (seconds) => {
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

describe('LapsTable', () => {
  beforeEach(() => {
    // Reset mocks if needed, though vi.fn() are auto-reset if using `clearMocks` in vitest config
    vi.clearAllMocks();
  });

  it('1. Initial Render: displays main lap data, no expanded details', () => {
    render(<LapsTable laps={mockLaps} />);
    // Check for some main table data (distance is good as it's always visible)
    expect(screen.getByText('1.0 km')).toBeInTheDocument(); // Lap 0
    expect(screen.getByText('1.2 km')).toBeInTheDocument(); // Lap 1
    expect(screen.getByText('1.1 km')).toBeInTheDocument(); // Lap 2

    // Check that no expanded content is visible
    expect(screen.queryByTestId('power-cdf-plot-mock')).not.toBeInTheDocument();
    expect(screen.queryByText(/Timestamp \(End\):/)).not.toBeInTheDocument(); // Fallback label
    expect(screen.queryByTestId('metric-average-power')).not.toBeInTheDocument();
  });

  it('2. Expand/Collapse: toggles visibility of details section', () => {
    render(<LapsTable laps={mockLaps} />);
    const firstLapRow = screen.getByText('1.0 km').closest('tr'); // Find by a unique cell in the first lap

    fireEvent.click(firstLapRow);
    // Lap 0 has full power, so PowerCdfPlot should be there
    expect(screen.getByTestId('power-cdf-plot-mock')).toBeInTheDocument();
    expect(screen.getByTestId('metric-average-power')).toBeInTheDocument();


    fireEvent.click(firstLapRow);
    expect(screen.queryByTestId('power-cdf-plot-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-average-power')).not.toBeInTheDocument();
  });

  it('3. Display Power Summary Details: shows plot and power metrics when available', () => {
    render(<LapsTable laps={[mockLaps[0]]} />); // Only lap with full power data
    const lapRow = screen.getByText('1.0 km').closest('tr');

    fireEvent.click(lapRow);
    expect(screen.getByTestId('power-cdf-plot-mock')).toBeInTheDocument();

    const avgPowerMetric = screen.getByTestId('metric-average-power');
    expect(avgPowerMetric).toHaveTextContent('Average Power:');
    expect(avgPowerMetric).toHaveTextContent('150');
    expect(avgPowerMetric).toHaveTextContent('W');

    const medianPowerMetric = screen.getByTestId('metric-median-power');
    expect(medianPowerMetric).toHaveTextContent('Median Power:');
    expect(medianPowerMetric).toHaveTextContent('145');
    expect(medianPowerMetric).toHaveTextContent('W');

    // Check that fallback details are NOT displayed
    expect(screen.queryByText(/Timestamp \(End\):/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Max Speed:/)).not.toBeInTheDocument();
  });

  it('4. Display Fallback Details (No Power Summary): shows other lap data', () => {
    render(<LapsTable laps={[mockLaps[1]]} />); // Lap with no power summary
    const lapRow = screen.getByText('1.2 km').closest('tr');
    const lapData = mockLaps[1];

    fireEvent.click(lapRow);
    expect(screen.queryByTestId('power-cdf-plot-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-average-power')).not.toBeInTheDocument();

    // Check for fallback details (using a regex for flexibility with label styling)
    expect(screen.getByText(/Timestamp \(End\):/)).toBeInTheDocument();
    expect(screen.getByText(new Date(lapData.timestamp).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(/Start Time:/)).toBeInTheDocument();
    expect(screen.getByText(new Date(lapData.start_time).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(/Elapsed Time:/)).toBeInTheDocument();
    expect(screen.getByText(formatDuration(lapData.total_elapsed_time))).toBeInTheDocument();
    expect(screen.getByText(/Max Speed:/)).toBeInTheDocument();
    expect(screen.getByText(lapData.max_speed.toFixed(2) + " km/h")).toBeInTheDocument(); // formatNumber default
    expect(screen.getByText(/Max Power:/)).toBeInTheDocument(); // Should show lapData.max_power
    expect(screen.getByText(lapData.max_power.toFixed(0) + " W")).toBeInTheDocument();
    expect(screen.getByText(/Ascent:/)).toBeInTheDocument();
    expect(screen.getByText(lapData.total_ascent.toFixed(0) + " m")).toBeInTheDocument();
  });

  it('5. Display Fallback Details (Power Summary but No Quantiles): shows relevant data', () => {
    render(<LapsTable laps={[mockLaps[2]]} />); // Lap with power_summary but no quantiles
    const lapRow = screen.getByText('1.1 km').closest('tr');
    const lapData = mockLaps[2];

    fireEvent.click(lapRow);
    expect(screen.queryByTestId('power-cdf-plot-mock')).not.toBeInTheDocument();
    // Average power from Metric should not be there, as plot section is skipped
    expect(screen.queryByTestId('metric-average-power')).not.toBeInTheDocument();

    expect(screen.getByText(/Timestamp \(End\):/)).toBeInTheDocument();
    // Median power should be in fallback
    expect(screen.getByText(/Median Power:/)).toBeInTheDocument();
    expect(screen.getByText(lapData.power_summary.median_power.toFixed(0) + " W")).toBeInTheDocument();
     // Max power should be in fallback
    expect(screen.getByText(/Max Power:/)).toBeInTheDocument();
    expect(screen.getByText(lapData.max_power.toFixed(0) + " W")).toBeInTheDocument();
    expect(screen.getByText(/Ascent:/)).toBeInTheDocument();
  });

  it('6. Multiple Expansions: handles multiple rows correctly', () => {
    render(<LapsTable laps={mockLaps} />);
    const firstLapRow = screen.getByText('1.0 km').closest('tr'); // Full power
    const secondLapRow = screen.getByText('1.2 km').closest('tr'); // No power summary

    // Expand first lap
    fireEvent.click(firstLapRow);
    expect(screen.getByTestId('power-cdf-plot-mock')).toBeInTheDocument(); // Lap 0 expanded
    expect(screen.queryByText(/Timestamp \(End\):/)).not.toBeInTheDocument(); // Lap 1 details not yet visible


    // Expand second lap
    fireEvent.click(secondLapRow);
    expect(screen.getByTestId('power-cdf-plot-mock')).toBeInTheDocument(); // Lap 0 still expanded
    expect(screen.getByText(/Timestamp \(End\):/)).toBeInTheDocument(); // Lap 1 expanded, showing its fallback details

    // Collapse first lap
    fireEvent.click(firstLapRow);
    expect(screen.queryByTestId('power-cdf-plot-mock')).not.toBeInTheDocument(); // Lap 0 collapsed
    expect(screen.getByText(/Timestamp \(End\):/)).toBeInTheDocument(); // Lap 1 still expanded
  });

  it('handles laps being null or empty or having only one lap gracefully', () => {
    const { rerender } = render(<LapsTable laps={null} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    rerender(<LapsTable laps={[]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    rerender(<LapsTable laps={[mockLaps[0]]} />); // Only one lap
    expect(screen.queryByRole('table')).not.toBeInTheDocument(); // Should not render table for single lap
  });

});
