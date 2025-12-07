import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetToken, ParseBackendResponse } from '../Utils';
import PowerCurve from '../power/PowerCurve';
import TrainingVolumeChart from './TrainingVolumeChart';
import { MetricBox } from '../MetricComponents';


function Profile() {
    const [fullname, setFullname] = useState('');
    const [ftp, setFtp] = useState('');
    const [zones, setZones] = useState(Array(6).fill(''));
    const [powerCurve, setPowerCurve] = useState({});
    const [selectedPeriod, setSelectedPeriod] = useState('all');
    // Stats Tab State
    const [statsTab, setStatsTab] = useState('all'); // all, year, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [summaryStats, setSummaryStats] = useState(null);

    // const [stats, setStats] = useState([]); // Deprecated in favor of summaryStats
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
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });

    }, [navigate]);

    // Fetch Summary Stats
    useEffect(() => {
        const token = GetToken();
        if (!token) return;

        let url = `${import.meta.env.VITE_BACKEND_URL}/users/me/stats/summary`;
        const params = new URLSearchParams();

        if (statsTab === 'year') {
            const year = new Date().getFullYear();
            params.append('start_date', `${year}-01-01`);
            params.append('end_date', `${year}-12-31`);
        } else if (statsTab === 'custom') {
            if (customStart) params.append('start_date', customStart);
            if (customEnd) params.append('end_date', customEnd);
            // If custom and no dates, it might default to all time or empty. 
            // Ideally we wait for user input. But for now let's fetch whatever.
            if (!customStart && !customEnd) {
                // Maybe don't fetch yet? Or fetch all?
                // Let's not fetch if custom and empty to avoid confusion, or fetch all.
            }
        }

        // If tab is 'all', no params needed.

        fetch(`${url}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (res.ok) return res.json();
                return null;
            })
            .then(data => setSummaryStats(data))
            .catch(console.error);

    }, [statsTab, customStart, customEnd, navigate]);



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

                {/* Stats Tabs */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
                    <div className="flex space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        {['all', 'year', 'custom'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setStatsTab(tab)}
                                className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${statsTab === tab
                                    ? 'bg-white dark:bg-gray-600 shadow text-indigo-600 dark:text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {tab === 'all' ? 'All Time' : tab === 'year' ? 'This Year' : 'Custom'}
                            </button>
                        ))}
                    </div>

                    {statsTab === 'custom' && (
                        <div className="flex space-x-2 mt-2 sm:mt-0">
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <span className="self-center text-gray-500">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    )}
                </div>

                {/* Basic Stats Summary */}
                {summaryStats && (
                    <div className="mb-8 space-y-4">
                        {/* Totals Row */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Totals</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <MetricBox name="Distance" value={`${summaryStats.distance.toFixed(0)} km`} />
                                <MetricBox name="Elevation" value={`${summaryStats.elevation_gain.toFixed(0)} m`} />
                                <MetricBox name="Time" value={`${(summaryStats.moving_time / 3600).toFixed(0)} h`} />
                                <MetricBox name="Work" value={`${summaryStats.total_work} kJ`} />
                                <MetricBox name="Activities" value={summaryStats.activity_count} />
                            </div>
                        </div>

                        {/* Records Row */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">Records</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricBox name="Longest Dist" value={`${summaryStats.max_distance.toFixed(1)} km`} />
                                <MetricBox name="Highest Elev" value={`${summaryStats.max_elevation_gain.toFixed(0)} m`} />
                                <MetricBox name="Longest Time" value={`${(summaryStats.max_moving_time / 3600).toFixed(1)} h`} />
                                <MetricBox name="Fastest Speed" value={`${(summaryStats.max_speed * 3600).toFixed(1)} km/h`} />
                            </div>
                        </div>
                    </div>
                )}
                {/* Training Volume Chart */}
                <TrainingVolumeChart />

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
