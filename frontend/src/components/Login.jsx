import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


function Login() {
  // State variables to store username and password
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Function to handle form submission (simulate login for now)
  const handleSubmit = (event) => {
    event.preventDefault();
    // Create form data object
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    fetch(`${import.meta.env.VITE_BACKEND_URL}/token`, {method: 'POST', body: formData})
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

  return (
    <>
      <section className="bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
          <div className="w-full bg-white rounded-lg shadow dark:border md:mt-0 sm:max-w-md xl:p-0 dark:bg-gray-800 dark:border-gray-700">
            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-indigo-900 md:text-2xl dark:text-white">
                Sign in to your account
              </h1>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input 
                        id="remember" 
                        className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-primary-600 dark:ring-offset-gray-800" required=""
                        aria-describedby="remember" 
                        type="checkbox" 
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label 
                        htmlFor="remember" 
                        className="text-gray-500 dark:text-gray-300"
                        >Remember me
                      </label>
                    </div>
                  </div>
                  <a href="#" className="text-sm font-medium text-indigo-600 hover:underline dark:text-primary-500">
                    Forgot password?
                  </a>
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
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Login;