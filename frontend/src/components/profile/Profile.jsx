import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetToken, ParseBackendResponse } from '../Utils';
import TrainingVolumeChart from './TrainingVolumeChart';
import StatsSummary from './StatsSummary';
import StatsControls from './StatsControls';
import PowerCurveSection from './PowerCurveSection';
import ProfileForm from './ProfileForm';

function Profile() {
    const [fullname, setFullname] = useState('');
    const [ftp, setFtp] = useState('');
    const [zones, setZones] = useState(Array(6).fill(''));
    const [powerCurve, setPowerCurve] = useState({});

    // Stats Tab State
    const [statsTab, setStatsTab] = useState('all'); // all, year, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [summaryStats, setSummaryStats] = useState(null);

    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();


    const [activeMainTab, setActiveMainTab] = useState('stats'); // stats, volume, power
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);

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

    const tabs = [
        { id: 'stats', label: 'Stats' },
        { id: 'volume', label: 'Training Volume' },
        { id: 'power', label: 'Power Curve' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Profile Header / Collapsible Form */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {fullname ? `${fullname}'s Profile` : 'User Profile'}
                        </h2>
                        <button
                            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                            {isProfileExpanded ? 'Collapse Settings' : 'Edit Profile Settings'}
                        </button>
                    </div>

                    {isProfileExpanded && (
                        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <ProfileForm
                                fullname={fullname} setFullname={setFullname}
                                ftp={ftp} setFtp={setFtp}
                                zones={zones} setZones={setZones}
                                onSubmit={handleSubmit}
                            />
                        </div>
                    )}
                </div>

                {/* Main Tabs Navigation */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveMainTab(tab.id)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                    ${activeMainTab === tab.id
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeMainTab === 'stats' && (
                        <div>
                            <StatsControls
                                activeTab={statsTab} onTabChange={setStatsTab}
                                customStart={customStart} onStartChange={setCustomStart}
                                customEnd={customEnd} onEndChange={setCustomEnd}
                            />
                            <StatsSummary stats={summaryStats} />
                        </div>
                    )}

                    {activeMainTab === 'volume' && (
                        <TrainingVolumeChart />
                    )}

                    {activeMainTab === 'power' && (
                        <PowerCurveSection powerCurveData={powerCurve} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default Profile;
