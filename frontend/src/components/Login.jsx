import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Login() {
  // State variables to store username and password
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authProvider, setAuthProvider] = useState('loading'); // local, external, loading
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for error in URL params
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error) {
      alert(`Login error: ${decodeURIComponent(error)}`);
    }

    // Fetch auth config
    fetch(`${import.meta.env.VITE_BACKEND_URL}/config`)
      .then(res => res.json())
      .then(data => {
        setAuthProvider(data.auth_provider || 'local');
      })
      .catch(err => {
        console.error('Failed to fetch config', err);
        setAuthProvider('local'); // Fallback
      });
  }, [location]);

  // Function to handle form submission (simulate login for now)
  const handleSubmit = (event) => {
    event.preventDefault();
    // Create form data object
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    fetch(`${import.meta.env.VITE_BACKEND_URL}/token`, { method: 'POST', body: formData })
      .then((response) => {
        if (!response.ok) {
          alert('Wrong username or password')
          throw new Error(`Login failed with status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log('Login successful:', data);
        localStorage.setItem('token', data.access_token);
        // Handle successful login (e.g., redirect to another page)
        navigate('/');
      })
      .catch((error) => {
        console.error('Login error:', error);
        // Handle login errors (e.g., display an error message)
      });
  };

  const handleExternalLogin = () => {
    // Construct Auth Service UI URL
    // We use a new env var VITE_AUTH_SERVICE_UI_URL for the frontend, 
    // falling back to VITE_AUTH_SERVICE_URL or localhost for compatibility.
    const authServiceUiUrl = import.meta.env.VITE_AUTH_SERVICE_UI_URL || import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5173';

    // The redirect URI where Auth Service should send the token back
    const redirectUri = `${window.location.origin}/login/callback`;

    // Redirect to Auth Service Login Page
    // We pass 'redirect_uri' which the Auth Service Login Page uses for the Google Login button.
    window.location.href = `${authServiceUiUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  if (authProvider === 'loading') {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <>
      <section className="bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
          <div className="w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md xl:p-0 dark:bg-gray-800 dark:border-gray-700">
            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-indigo-900 md:text-2xl dark:text-white">
                Sign in to your account
              </h1>

              {authProvider === 'external' ? (
                <div className="space-y-4">
                  <button
                    onClick={handleExternalLogin}
                    className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 19">
                      <path fillRule="evenodd" d="M8.842 18.083a8.8 8.8 0 0 1-8.65-8.948 8.841 8.841 0 0 1 8.8-8.652h.153a8.464 8.464 0 0 1 5.7 2.257l-2.193 2.038A5.27 5.27 0 0 0 9.09 3.4a5.882 5.882 0 0 0-.2 11.76h.124a5.091 5.091 0 0 0 5.248-4.057L14.3 11H9V8h8.34c.066.543.095 1.09.088 1.636-.086 5.053-3.463 8.449-8.4 8.449l-.186-.002Z" clipRule="evenodd" />
                    </svg>
                    Go to Login Page (Auth Service)
                  </button>
                  <p className="text-sm text-center text-gray-500">
                    You are using External Authentication
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-4 md:space-y-6"
                  onSubmit={handleSubmit}
                >
                  <div>
                    <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Username
                    </label>
                    <input
                      className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      type="text"
                      name="username"
                      id="username"
                      value={username}
                      placeholder="name@company.com"
                      required=""
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Password
                    </label>
                    <input
                      className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      type="password"
                      name="password"
                      id="password"
                      value={password}
                      placeholder="••••••••••••••••"
                      required=""
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800">
                    Sign in
                  </button>
                  <p className="text-sm font-light text-gray-500 dark:text-gray-400">
                    Don’t have an account yet?
                    <a href="#" className="font-medium text-primary-600 hover:underline dark:text-primary-500">
                      Sign up
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Login;