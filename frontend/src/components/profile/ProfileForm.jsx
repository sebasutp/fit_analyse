import React from 'react';

function ProfileForm({ fullname, setFullname, ftp, setFtp, zones, setZones, onSubmit }) {

    const handleZoneChange = (index, value) => {
        const newZones = [...zones];
        newZones[index] = value;
        setZones(newZones);
    };

    const calculateZones = () => {
        if (!ftp || ftp <= 0) {
            alert("Please enter a valid FTP");
            return;
        }
        const ftpVal = parseInt(ftp);
        // Coggan Zones Upper Bounds
        // Z1: 55%
        // Z2: 75%
        // Z3: 90%
        // Z4: 105%
        // Z5: 120%
        // Z6: 150%
        const newZones = [
            Math.round(ftpVal * 0.55),
            Math.round(ftpVal * 0.75),
            Math.round(ftpVal * 0.90),
            Math.round(ftpVal * 1.05),
            Math.round(ftpVal * 1.20),
            Math.round(ftpVal * 1.50)
        ];
        setZones(newZones);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">User Profile</h2>
            <form onSubmit={onSubmit} className="space-y-6">

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        FTP (Watts)
                    </label>
                    <div className="flex space-x-2">
                        <input
                            type="number"
                            value={ftp}
                            onChange={(e) => setFtp(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                        />
                        <button
                            type="button"
                            onClick={calculateZones}
                            className="mt-1 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Auto-calc Zones
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Updates zones based on Coggan levels.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Power Zones (Upper Limits)
                    </label>
                    <div className="space-y-2">
                        {zones.map((limit, idx) => (
                            <div key={idx} className="flex items-center">
                                <span className="w-20 text-sm text-gray-600 dark:text-gray-400">Zone {idx + 1}</span>
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => handleZoneChange(idx, e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                                    placeholder={`Limit for Z${idx + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Zone 7 is anything above Zone 6 limit.</p>
                </div>

                <div className="flex justify-end items-center pt-4">
                    <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Save Changes
                    </button>
                </div>

            </form>
        </div>
    );
}

export default ProfileForm;
