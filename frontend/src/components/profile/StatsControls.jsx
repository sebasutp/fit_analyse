import React from 'react';

function StatsControls({ activeTab, onTabChange, customStart, onStartChange, customEnd, onEndChange }) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
            <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {['all', 'year', 'custom'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${activeTab === tab
                            ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                    >
                        {tab === 'all' ? 'All Time' : tab === 'year' ? 'This Year' : 'Custom'}
                    </button>
                ))}
            </div>

            {activeTab === 'custom' && (
                <div className="flex space-x-2 mt-2 sm:mt-0">
                    <input
                        type="date"
                        value={customStart}
                        onChange={e => onStartChange(e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <span className="self-center text-gray-500">-</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={e => onEndChange(e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
            )}
        </div>
    );
}

export default StatsControls;
