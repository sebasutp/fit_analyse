// frontend/src/components/activity/LapsTable.jsx

import React from 'react';

// Helper function to format seconds into HH:MM:SS or MM:SS
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return 'N/A';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper function to format date/time strings
const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  try {
    const date = new Date(dateTimeString);
    // Check if date is valid after parsing
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleString(); // Adjust format as needed
  } catch (e) {
    return 'Invalid Date String';
  }
};

// Helper function to format numbers, ensuring a fixed number of decimal places
const formatNumber = (num, decimalPlaces = 2) => {
  if (num === null || num === undefined || isNaN(num)) {
    return 'N/A';
  }
  return num.toFixed(decimalPlaces);
};

function LapsTable({ laps }) {
  if (!laps || laps.length <= 1) {
    return null;
  }

  // Define the headers that should always be displayed
  const displayHeaders = ['total_distance', 'total_timer_time', 'avg_speed', 'avg_power'];

  const tableHeaders = [
    { key: 'lap_number', label: 'Lap' },
    { key: 'timestamp', label: 'Timestamp (End)' },
    { key: 'start_time', label: 'Start Time' },
    { key: 'total_distance', label: 'Distance (km)' },
    { key: 'total_elapsed_time', label: 'Elapsed Time' },
    { key: 'total_timer_time', label: 'Timer Time' },
    { key: 'avg_speed', label: 'Avg Speed (km/h)' },
    { key: 'max_speed', label: 'Max Speed (km/h)' },
    { key: 'avg_power', label: 'Avg Power (W)' },
    { key: 'max_power', label: 'Max Power (W)' },
    { key: 'median_power', label: 'Median Power (W)' },
    { key: 'total_ascent', label: 'Ascent (m)' },
    { key: 'total_descent', label: 'Descent (m)' },
  ];

  return (
    <div className="my-4 overflow-x-auto">
      <h2 className="text-xl font-semibold mb-2">Laps</h2>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {tableHeaders.map((header) => (
              <th
                key={header.key}
                scope="col"
                // Conditionally apply 'hidden sm:table-cell' for columns not in displayHeaders
                // This means they will be hidden on small screens and shown on 'sm' (small) and larger screens.
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300 ${
                  displayHeaders.includes(header.key) ? '' : 'hidden sm:table-cell'
                }`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
          {laps.map((lap, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-850' : 'bg-white dark:bg-gray-900'}>
              {/* Lap Number - always visible */}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white hidden sm:table-cell">
                {index + 1}
              </td>

              {/* Timestamp (End) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatDateTime(lap.timestamp)}
              </td>

              {/* Start Time - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatDateTime(lap.start_time)}
              </td>

              {/* Distance (km) - always visible */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {formatNumber(lap.total_distance / 1000, 1)}
              </td>

              {/* Elapsed Time - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatDuration(lap.total_elapsed_time)}
              </td>

              {/* Timer Time - always visible */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {formatDuration(lap.total_timer_time)}
              </td>

              {/* Avg Speed (km/h) - always visible */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {formatNumber(lap.avg_speed)}
              </td>

              {/* Max Speed (km/h) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatNumber(lap.max_speed)}
              </td>

              {/* Avg Power (W) - always visible */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {formatNumber(lap.power_summary?.average_power, 0)}
              </td>

              {/* Max Power (W) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatNumber(lap.max_power, 0)}
              </td>

              {/* Median Power (W) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatNumber(lap.power_summary?.median_power, 0)}
              </td>

              {/* Ascent (m) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatNumber(lap.total_ascent, 0)}
              </td>

              {/* Descent (m) - hidden on small screens */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell">
                {formatNumber(lap.total_descent, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LapsTable;