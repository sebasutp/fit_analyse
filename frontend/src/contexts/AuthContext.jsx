import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [authProviderConfig, setAuthProviderConfig] = useState(null); // 'local' or 'external'
    const [isLoading, setIsLoading] = useState(true);

    const checkConfig = useCallback(async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/config`);
            if (response.ok) {
                const data = await response.json();
                setAuthProviderConfig(data.auth_provider);
            }
        } catch (error) {
            console.error("Failed to fetch auth config:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkConfig();
    }, [checkConfig]);

    const login = useCallback((newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    }, []);

    const loginWithExternalToken = useCallback(async (externalToken) => {
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
        login(data.access_token);
    }, [login]);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        // Optional: Redirect to login page if not handled by components
        window.location.href = '/login';
    }, []);

    const value = {
        token,
        isAuthenticated: !!token,
        authProviderConfig,
        isLoading,
        login,
        loginWithExternalToken,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
