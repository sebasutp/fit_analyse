import React from 'react';
import { MetricBox } from '../MetricComponents';

function StatsSummary({ stats }) {
    if (!stats) return null;

    return (
        <div className="mb-8 space-y-4">
            {/* Totals Row */}
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Totals</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <MetricBox name="Distance" value={`${stats.distance.toFixed(0)} km`} />
                    <MetricBox name="Elevation" value={`${stats.elevation_gain.toFixed(0)} m`} />
                    <MetricBox name="Time" value={`${(stats.moving_time / 3600).toFixed(0)} h`} />
                    <MetricBox name="Work" value={`${stats.total_work} kJ`} />
                    <MetricBox name="Activities" value={stats.activity_count} />
                </div>
            </div>

            {/* Records Row */}
            <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Records</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricBox name="Longest Dist" value={`${stats.max_distance.toFixed(1)} km`} />
                    <MetricBox name="Highest Elev" value={`${stats.max_elevation_gain.toFixed(0)} m`} />
                    <MetricBox name="Longest Time" value={`${(stats.max_moving_time / 3600).toFixed(1)} h`} />
                    <MetricBox name="Fastest Speed" value={`${(stats.max_speed * 3600).toFixed(1)} km/h`} />
                </div>
            </div>
        </div>
    );
}

export default StatsSummary;
