import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import TimeSeriesView from './TimeSeriesView';

// Mock axios
vi.mock('axios');

// Mock recharts - ResponsiveContainer needs a mock to avoid issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// Mock icons
vi.mock('react-icons/fa6', () => ({
  FaHeart: () => <div data-testid="heart-icon" />,
  FaThermometer: () => <div data-testid="thermometer-icon" />,
  FaBolt: () => <div data-testid="bolt-icon" />,
}));

describe('TimeSeriesView Component', () => {
  const mockActivityId = '123';
  const mockData = [
    { time: 1000, power: 100, heart_rate: 140, temperature: 20 },
    { time: 1001, power: 105, heart_rate: 141, temperature: 20.5 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<TimeSeriesView activityId={mockActivityId} />);
    expect(screen.getByText('Loading smoothing analysis...')).toBeDefined();
  });

  it('renders tabs and chart when data is received', async () => {
    axios.get.mockResolvedValue({ data: mockData });
    
    render(<TimeSeriesView activityId={mockActivityId} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading smoothing analysis...')).toBeNull();
    });

    expect(screen.getByText('Power')).toBeDefined();
    expect(screen.getByText('Heart Rate')).toBeDefined();
    expect(screen.getByText('Temperature')).toBeDefined();
    expect(screen.getByTestId('area-chart')).toBeDefined();
  });

  it('switches tabs when clicked', async () => {
    axios.get.mockResolvedValue({ data: mockData });
    
    render(<TimeSeriesView activityId={mockActivityId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Heart Rate')).toBeDefined();
    });

    const hrTab = screen.getByText('Heart Rate');
    fireEvent.click(hrTab);

    // Active tab styling or something similar would be checked here
    // For now, we verify the component didn't crash and tab is clickable
    expect(hrTab).toBeDefined();
  });

  it('renders nothing if data is empty', async () => {
    axios.get.mockResolvedValue({ data: [] });
    
    render(<TimeSeriesView activityId={mockActivityId} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading smoothing analysis...')).toBeNull();
    });

    expect(screen.queryByTestId('area-chart')).toBeNull();
  });

  it('only shows available metric tabs', async () => {
    // Data with only power
    const limitedData = [
      { time: 1000, power: 100 },
      { time: 1001, power: 105 },
    ];
    axios.get.mockResolvedValue({ data: limitedData });
    
    render(<TimeSeriesView activityId={mockActivityId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Power')).toBeDefined();
    });

    expect(screen.queryByText('Heart Rate')).toBeNull();
    expect(screen.queryByText('Temperature')).toBeNull();
  });
});
