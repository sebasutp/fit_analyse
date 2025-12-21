function ActivityFilters({ searchQuery, setSearchQuery, selectedTab, setSelectedTab }) {
    return (
        <div>
            {/* Search Input */}
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
                <input
                    type="text"
                    placeholder="Search by title or tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '10px', width: '300px' }}
                    className="border border-gray-300 rounded-md p-2"
                />
            </div>
            {/* Tab Navigation */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                    onClick={() => setSelectedTab('recorded')}
                    style={{ marginRight: '10px', padding: '10px', cursor: 'pointer', backgroundColor: selectedTab === 'recorded' ? 'lightblue' : 'white' }}
                    className={`px-4 py-2 rounded-md ${selectedTab === 'recorded' ? 'bg-blue-200' : 'bg-white border border-gray-300'}`}
                >
                    Recorded Activities
                </button>
                <button
                    onClick={() => setSelectedTab('route')}
                    style={{ padding: '10px', cursor: 'pointer', backgroundColor: selectedTab === 'route' ? 'lightblue' : 'white' }}
                    className={`px-4 py-2 rounded-md ${selectedTab === 'route' ? 'bg-blue-200' : 'bg-white border border-gray-300'}`}
                >
                    Routes
                </button>
            </div>
        </div>
    );
}

export default ActivityFilters;
