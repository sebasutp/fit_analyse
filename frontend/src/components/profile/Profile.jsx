
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetToken, ParseBackendResponse } from '../Utils';
import PowerCurve from '../power/PowerCurve';

function Profile() {
    const [fullname, setFullname] = useState('');
    const [ftp, setFtp] = useState('');
    const [zones, setZones] = useState(Array(6).fill(''));
    const [powerCurve, setPowerCurve] = useState({});
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = GetToken();
        if (!token) {
            navigate('/login');
            return;
        }

        fetch(`${import.meta.env.VITE_BACKEND_URL}/user/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => ParseBackendResponse(res, navigate))
            .then(data => {
                if (data) {
                    setFullname(data.fullname || '');
                    setFtp(data.ftp || '');
                    if (data.power_zones && data.power_zones.length === 6) {
                        setZones(data.power_zones);
                    }
                    if (data.power_zones && data.power_zones.length === 6) {
                        setZones(data.power_zones);
                    }
                    let pc = data.power_curve || {};
                    if (Array.isArray(pc)) {
                        pc = { 'all': pc };
                    }
                    setPowerCurve(pc);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [navigate]);

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

    const handleSubmit = (e) => {
        e.preventDefault();
        const token = GetToken();
        const powerZones = zones.map(z => parseInt(z));

        // Validate zones are ascending
        for (let i = 0; i < powerZones.length - 1; i++) {
            if (powerZones[i] >= powerZones[i + 1]) {
                alert(`Zone ${i + 1} limit must be less than Zone ${i + 2} limit.`);
                return;
            }
        }

        const payload = {
            fullname,
            ftp: parseInt(ftp),
            power_zones: powerZones
        };

        fetch(`${import.meta.env.VITE_BACKEND_URL}/user/me`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(res => ParseBackendResponse(res, navigate))
            .then(data => {
                if (data) {
                    alert("Profile updated successfully!");
                }
            })
            .catch(err => console.error(err));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-6">

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">User Profile</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">

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
                    <PowerCurve powerCurveData={powerCurve[selectedPeriod] || []} />
                </div>
            </div>
        </div>
    );
}

export default Profile;
