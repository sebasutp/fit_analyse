import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { FaHeart, FaThermometer, FaBolt } from "react-icons/fa6";

const TimeSeriesView = ({ activityId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('power');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/activity/${activityId}/processed_series`);
        setData(response.data);
        
        if (response.data.length > 0) {
          const firstPoint = response.data[0];
          if (firstPoint.power !== undefined) setActiveTab('power');
          else if (firstPoint.heart_rate !== undefined) setActiveTab('heart_rate');
          else if (firstPoint.temperature !== undefined) setActiveTab('temperature');
        }
      } catch (err) {
        console.error("Error fetching time series data:", err);
        setError("Failed to load time series data");
      } finally {
        setLoading(false);
      }
    };

    if (activityId) fetchData();
  }, [activityId]);

  const metrics = [
    { id: 'power', label: 'Power', icon: FaBolt, color: '#a855f7', unit: 'W' },
    { id: 'heart_rate', label: 'Heart Rate', icon: FaHeart, color: '#ef4444', unit: 'bpm' },
    { id: 'temperature', label: 'Temperature', icon: FaThermometer, color: '#3b82f6', unit: '°C' },
  ];

  const availableMetrics = metrics.filter(m => data.length > 0 && data[0][m.id] !== undefined);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const metric = metrics.find(m => m.id === activeTab);
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {new Date(label * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }}></div>
            <p className="font-bold text-gray-900 dark:text-white">
              {payload[0].value.toFixed(1)} <span className="text-sm font-normal text-gray-500">{metric.unit}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="w-full h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl animate-pulse">
      <p className="text-gray-500 text-sm">Loading smoothing analysis...</p>
    </div>
  );

  if (error || availableMetrics.length === 0) return null;

  const currentMetric = metrics.find(m => m.id === activeTab);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 px-4 overflow-x-auto">
        {availableMetrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setActiveTab(metric.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap ${
              activeTab === metric.id 
                ? 'text-gray-900 dark:text-white' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <metric.icon className={activeTab === metric.id ? 'text-current' : 'text-gray-300'} />
            {metric.label}
            {activeTab === metric.id && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5" 
                style={{ backgroundColor: metric.color }}
              ></div>
            )}
          </button>
        ))}
      </div>

      {/* Chart Area */}
      <div className="p-4 sm:p-6 h-[250px] sm:h-[350px] lg:h-[400px]">

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${activeTab}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentMetric.color} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={currentMetric.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="time" 
              hide={true}
              type="number"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              axisLine={false} 
              tickLine={false}
              unit={currentMetric.unit}
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 20 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey={activeTab} 
              stroke={currentMetric.color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#color${activeTab})`} 
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Footer Info */}
      <div className="px-6 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
        <span>Rolling average analysis</span>
        <span>Resolution: max 1000 points</span>
      </div>
    </div>
  );
};

export default TimeSeriesView;
