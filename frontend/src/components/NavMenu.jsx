import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function NavMenu() {
    const location = useLocation();
    const { isAuthenticated, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Don't show nav on login page
    if (location.pathname === '/login') {
        return null;
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-700 sticky top-0 z-50">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                <Link to="/" className="flex items-center space-x-3 rtl:space-x-reverse group">
                    <span className="self-center text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent group-hover:from-blue-500 group-hover:to-indigo-500 transition-all duration-300">
                        FitAnalyse
                    </span>
                </Link>
                <button
                    data-collapse-toggle="navbar-default"
                    type="button"
                    className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600 transition-colors duration-200"
                    aria-controls="navbar-default"
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <span className="sr-only">Open main menu</span>
                    <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1h15M1 7h15M1 13h15" />
                    </svg>
                </button>
                <div className={`${isMenuOpen ? 'block' : 'hidden'} w-full md:block md:w-auto`} id="navbar-default">
                    <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-800 md:dark:bg-transparent dark:border-gray-700">
                        <li>
                            <Link
                                to="/"
                                className={`block py-2 px-3 rounded md:p-0 transition-colors duration-200 ${location.pathname === '/' ? 'text-blue-700 dark:text-blue-500 font-bold' : 'text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-500 hover:bg-gray-100 md:hover:bg-transparent'}`}
                                aria-current={location.pathname === '/' ? 'page' : undefined}
                            >
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/profile"
                                className={`block py-2 px-3 rounded md:p-0 transition-colors duration-200 ${location.pathname === '/profile' ? 'text-blue-700 dark:text-blue-500 font-bold' : 'text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-500 hover:bg-gray-100 md:hover:bg-transparent'}`}
                            >
                                My Profile
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/batch-upload"
                                className={`block py-2 px-3 rounded md:p-0 transition-colors duration-200 ${location.pathname === '/batch-upload' ? 'text-blue-700 dark:text-blue-500 font-bold' : 'text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-500 hover:bg-gray-100 md:hover:bg-transparent'}`}
                            >
                                Batch Upload
                            </Link>
                        </li>
                        <li>
                            <button
                                onClick={logout}
                                className="block w-full text-left py-2 px-3 text-gray-900 rounded hover:bg-red-50 md:hover:bg-transparent md:border-0 md:hover:text-red-600 md:p-0 dark:text-white md:dark:hover:text-red-500 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent transition-colors duration-200"
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default NavMenu;
