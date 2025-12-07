import React, { useState } from 'react';
import PowerCurve from '../power/PowerCurve';

function PowerCurveSection({ powerCurveData }) {
    const [selectedPeriod, setSelectedPeriod] = useState('all');

    // powerCurveData is an object like { 'all': [...], '3m': [...] }
    const currentData = powerCurveData[selectedPeriod] || [];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Power Curve</h3>
                <div className="flex space-x-2">
                    {['all', '3m', '6m', '12m'].map(period => (
                        <button
                            key={period}
                            onClick={() => setSelectedPeriod(period)}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${selectedPeriod === period
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            {period === 'all' ? 'All Time' : period}
                        </button>
                    ))}
                </div>
            </div>
            <PowerCurve powerCurveData={currentData} />
        </div>
    );
}

export default PowerCurveSection;
