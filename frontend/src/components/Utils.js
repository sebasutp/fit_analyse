
export function ParseBackendResponse(response, navigate) {
  if (!response.ok) {
    if (response.status == 401) {
      // The token is invalid
      navigate("/login");
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