import React from 'react';
import Chart from "chart.js/auto";
import { Line } from "react-chartjs-2";

export function ElevCard({elevSummary}) {
  const chartData = {
    labels: elevSummary.dist_series, // X-axis
    datasets: [
      {
        label: 'Elevation',
        data: elevSummary.elev_series, // Y-axis
        fill: true, // Don't fill the area under the line
        borderColor: 'rgb(75, 192, 192)', // Line color
      },
    ],
  };

  const options = {
    scales: {
      x: {
        type: 'linear', // Use a linear scale for the x-axis
      },
    },
    responsive: true,
    aspectRatio: 1,
  };

  return (
    <div className="card-container">
      <h2 className="card-title">Altitude</h2>
      <Line data={chartData} options={options}/>
    </div>
  );
};