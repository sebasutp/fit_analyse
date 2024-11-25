import React from 'react';
import Chart from "chart.js/auto";
import { Line } from "react-chartjs-2";

const PowerCdfPlot = ({ powerQuantiles }) => {
  // Assuming powerQuantiles is an array containing power values

  const yQuantiles = [];
  for (let i = 0; i < powerQuantiles.length; i++) {
    yQuantiles.push(i / powerQuantiles.length);
  }
  const chartData = {
    labels: powerQuantiles, // X-axis labels (power values)
    datasets: [
      {
        label: 'CDF',
        data: yQuantiles, // Y-axis values (always 0 to 1 for CDF)
        fill: false, // Don't fill the area under the line
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
    <div>
        <Line data={chartData} options={options}/>
    </div>
  );
};

export default PowerCdfPlot;