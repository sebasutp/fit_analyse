import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale } from 'chart.js';
import { Line } from 'react-chartjs-2';
import propTypes from 'prop-types';

ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const PowerCurve = ({ powerCurveData }) => {
    if (!powerCurveData || powerCurveData.length === 0) {
        return (
            <div className="card-container">
                <h2 className="card-title">Power Curve</h2>
                <p className="text-gray-500 text-center py-4">No power data found for this period.</p>
            </div>
        );
    }

    // Format labels
    const labels = powerCurveData.map(d => {
        if (d.duration < 60) return `${d.duration}s`;
        if (d.duration < 3600) return `${Math.floor(d.duration / 60)}m${d.duration % 60 ? ' ' + d.duration % 60 + 's' : ''}`;
        return `${Math.floor(d.duration / 3600)}h${Math.floor((d.duration % 3600) / 60)}m`;
    });

    const dataPoints = powerCurveData.map(d => d.max_watts);

    const data = {
        labels: labels,
        datasets: [
            {
                label: 'Max Power (Watts)',
                data: dataPoints,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                tension: 0.3,
                pointRadius: 3,
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
                display: false,
            },
            tooltip: {
                intersect: false,
                mode: 'index',
                callbacks: {
                    title: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        return `Duration: ${labels[index]}`;
                    },
                    label: (context) => {
                        return `Power: ${Math.round(context.raw)} W`;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 10
                },
                title: {
                    display: true,
                    text: 'Duration'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Power (W)'
                },
                beginAtZero: true
            }
        }
    };

    return (
        <div className="card-container">
            <h2 className="card-title">Power Curve</h2>
            <div style={{ height: '300px' }}>
                <Line options={options} data={data} />
            </div>
        </div>
    );
};

PowerCurve.propTypes = {
    powerCurveData: propTypes.arrayOf(propTypes.shape({
        duration: propTypes.number.isRequired,
        max_watts: propTypes.number.isRequired
    }))
};

export default PowerCurve;
