import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function LoginCallback() {
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const hashParams = new URLSearchParams(location.hash.substring(1));
            
            const token = params.get('access_token') || params.get('token') || hashParams.get('access_token') || hashParams.get('token');

            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/exchange-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ external_token: token }),
                    credentials: 'include', // Important to send cookies to the backend
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || 'Token exchange failed');
                }

                const data = await response.json();
                localStorage.setItem('token', data.access_token);
                navigate('/');
            } catch (err) {
                setError(err.message);
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        handleCallback();
    }, [location, navigate]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-200 dark:border-red-900">
                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Authentication Error</h2>
                    <p className="text-gray-700 dark:text-gray-300">{error}</p>
                    <p className="text-sm text-gray-500 mt-4">Redirecting back to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Completing login...</p>
        </div>
    );
}

export default LoginCallback;
