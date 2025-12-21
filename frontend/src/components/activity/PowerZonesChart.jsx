
import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getElapsedTime } from '../Utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export function PowerZonesChart({ timeInZones }) {
    if (!timeInZones || timeInZones.length === 0) {
        return null;
    }

    // timeInZones is [z1_secs, z2_secs, ..., zN_secs]
    // Labels: Zone 1, Zone 2, ...
    const labels = timeInZones.map((_, index) => `Zone ${index + 1}`);

    // Format tooltip to show human readable time
    const formatTime = (seconds) => {
        return getElapsedTime(seconds);
    };

    const data = {
        labels,
        datasets: [
            {
                label: 'Time in Zone',
                data: timeInZones,
                backgroundColor: [
                    'rgba(156, 163, 175, 0.7)', // Z1 - Gray
                    'rgba(59, 130, 246, 0.7)',  // Z2 - Blue
                    'rgba(16, 185, 129, 0.7)',  // Z3 - Green
                    'rgba(245, 158, 11, 0.7)',  // Z4 - Yellow
                    'rgba(239, 68, 68, 0.7)',   // Z5 - Red
                    'rgba(124, 58, 237, 0.7)',  // Z6 - Purple
                    'rgba(236, 72, 153, 0.7)',  // Z7 - Pink
                ],
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Time in Power Zones',
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `Time: ${formatTime(context.raw)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    callback: function (value, index, values) {
                        // Show minutes roughly? Or just let it be seconds but labels might be large
                        // Let's show minutes
                        return (value / 60).toFixed(0) + 'm';
                    }
                },
                title: {
                    display: true,
                    text: 'Duration'
                }
            }
        }
    };

    return (
        <div className="h-80 lg:h-96">
            <Bar options={options} data={data} />
        </div>
    );
}
