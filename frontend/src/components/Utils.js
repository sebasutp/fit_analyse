
// Use external login if available. Otherwise, we built in login
export function navLogin(navigate) {
  const authServiceLoginUrl = import.meta.env.VITE_AUTH_SERVICE_LOGIN_URL;
  if (authServiceLoginUrl) {
    // Where the auth service should redirect BACK TO after successful login
    const clientRedirectUri = window.location.origin + '/auth/callback'; 
    // The scope this client app requires
    const clientScope = import.meta.env.VITE_REQUIRED_APP_SCOPE;

    const params = new URLSearchParams();
    params.append('redirect', clientRedirectUri);
    if (clientScope) {
      params.append('client_scope', clientScope);
    }
    // Redirect the user's browser
    window.location.href = `${authServiceLoginUrl}?${params.toString()}`;
  } else {
    navigate("/login");
  }
}

export function ParseBackendResponse(response, navigate) {
  if (!response.ok) {
    if (response.status == 401) {
      // The token is invalid
      //localStorage.removeItem('token');
      //navLogin(navigate);
    } else {
      console.error("API error: ", response);
    }
  }
  return response.json();
}

export function GetToken() {
    return localStorage.getItem('token');
}

export function getElapsedTime(seconds) {
  let x = seconds;
  const sec = x % 60;
  x -= sec;
  x = x / 60;
  const min = x % 60;
  x -= min;
  x = x / 60;
  const hours = x;
  return [
    `${hours.toString().padStart(2, '0')}`,
    `${min.toString().padStart(2, '0')}`,
    `${sec.toString().padStart(2, '0')}`].join(":")
}