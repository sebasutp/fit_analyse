
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