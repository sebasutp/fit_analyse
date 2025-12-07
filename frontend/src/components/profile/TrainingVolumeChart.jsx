import React, { useState, useEffect } from 'react';
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
import { GetToken } from '../Utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const TrainingVolumeChart = () => {
    const [period, setPeriod] = useState('3m');
    const [unit, setUnit] = useState('distance'); // distance, time, calories
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const token = GetToken();
            if (!token) return;

            try {
                const url = `${import.meta.env.VITE_BACKEND_URL}/users/me/stats/volume?period=${period}`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                } else {
                    console.error("Failed to fetch volume stats");
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period]);

    const chartData = {
        labels: data.map(d => d.week), // Or use date formatted
        datasets: [
            {
                label: unit === 'distance' ? 'Distance (km)' : unit === 'time' ? 'Time (h)' : 'Calories (kcal)',
                data: data.map(d => d[unit]),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    title: (tooltipItems) => {
                        // week is stored in label
                        return `Week: ${tooltipItems[0].label}`;
                    }
                }
            }
        },
        maintainAspectRatio: false,
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0">Training Volume</h3>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    {/* Unit Selector */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        {['distance', 'time', 'calories'].map((u) => (
                            <button
                                key={u}
                                onClick={() => setUnit(u)}
                                className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${unit === u
                                    ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>

                    {/* Period Selector */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        {['3m', '6m', '1y', 'all'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-sm rounded-md uppercase transition-colors ${period === p
                                    ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-80 w-full">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>
                ) : data.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-gray-500">No data available</div>
                ) : (
                    <Bar options={options} data={chartData} />
                )}
            </div>
        </div>
    );
};

export default TrainingVolumeChart;
