import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function LoginCallback() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleCallback = async () => {
            // 1. Parse token from URL fragment (hash) OR query params
            const hash = location.hash.substring(1); // Remove leading '#'
            const hashParams = new URLSearchParams(hash);
            const searchParams = new URLSearchParams(location.search);

            const externalToken = hashParams.get('access_token') || hashParams.get('token') || searchParams.get('access_token') || searchParams.get('token');
            const error = hashParams.get('error') || searchParams.get('error');

            if (error) {
                console.error('Auth error:', error);
                navigate('/login?error=' + encodeURIComponent(error));
                return;
            }

            if (!externalToken) {
                console.error('No access token found');
                navigate('/login?error=no_token');
                return;
            }

            // 2. Exchange external token for local token
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/exchange-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ external_token: externalToken }),
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.detail || 'Token exchange failed');
                }

                const data = await response.json();

                // 3. Store local token and redirect
                console.log('Login successful via external auth');
                localStorage.setItem('token', data.access_token);
                navigate('/');

            } catch (err) {
                console.error('Exchange error:', err);
                navigate('/login?error=' + encodeURIComponent(err.message));
            }
        };

        handleCallback();
    }, [location, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Authenticating...</h2>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
        </div>
    );
}

export default LoginCallback;
