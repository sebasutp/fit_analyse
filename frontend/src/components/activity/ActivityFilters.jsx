function ActivityFilters({ searchQuery, setSearchQuery, selectedTab, setSelectedTab }) {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 px-4">
            {/* Search Input */}
            <div className="w-full md:w-1/3">
                <div className="relative">
                    <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by title or tag..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full p-4 ps-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-all duration-200"
                    />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                    onClick={() => setSelectedTab('recorded')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${selectedTab === 'recorded'
                        ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                >
                    Recorded
                </button>
                <button
                    onClick={() => setSelectedTab('route')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${selectedTab === 'route'
                        ? 'bg-white dark:bg-gray-600 text-blue-700 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                >
                    Routes
                </button>
            </div>
        </div>
    );
}

export default ActivityFilters;
