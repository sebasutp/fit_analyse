import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Paper,
  Container,
} from "@mui/material";

function logout() {
  localStorage.removeItem("token");
}


const AuthCallback = () => {
  const location = useLocation(); // Hook to access URL properties (hash, search)
  const navigate = useNavigate(); // Hook for programmatic navigation
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // This effect runs once when the component mounts
    const handleAuthCallback = async () => {
      setIsLoading(true);
      setError(null);

      // --- Check URL Fragment for Token (Success Case) ---
      const hashParams = new URLSearchParams(location.hash.substring(1)); // Remove leading '#'
      const token = hashParams.get("token");
      const hashLoginStatus = hashParams.get("login_status"); // e.g., 'success'

      // --- Check URL Query Params for Status/Error ---
      const queryParams = new URLSearchParams(location.search);
      const queryLoginStatus = queryParams.get("login_status"); // e.g., 'access_denied'
      const reason = queryParams.get("reason");
      const requiredScope = queryParams.get("required_scope");

      // --- Clean the URL ---
      // Remove hash and query parameters immediately so they don't persist
      // navigate('.', { replace: true }); // More modern way using relative path '.'
      // Or fallback:
      window.history.replaceState({}, document.title, location.pathname);

      console.log(token);
      console.log(hashLoginStatus);

      if (token && hashLoginStatus === "success") {
        console.log("AuthCallbackPage: Token found in URL hash.");
        try {
          // Attempt to process the token (stores it, fetches user, updates context)
          localStorage.setItem('token', token);
          console.log("AuthCallbackPage: Token processed successfully.");
          // Redirect to a default logged-in destination
          // TODO: Enhance this to redirect to the originally intended page if possible
          // (e.g., retrieve from localStorage if stored before redirecting to Google)
          navigate("/", { replace: true }); // Navigate to admin dashboard
        } catch (err) {
          console.error("AuthCallbackPage: Error processing token:", err);
          setError(
            "Login failed: Could not validate session. Please try logging in again."
          );
          logout(); // Ensure inconsistent state is cleared
          // Optionally navigate back to login after a delay or keep error message here
          setIsLoading(false); // Stop loading to show error
          // Consider navigating to login after showing error:
          // setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
        // No need to setIsLoading(false) here if navigating away successfully
      } else if (queryLoginStatus === "access_denied") {
        console.warn(
          "AuthCallbackPage: Access denied status found in query parameters."
        );
        let errorMessage =
          "Access Denied. You do not have permission to access the requested resource.";
        if (reason === "scope_missing" && requiredScope) {
          errorMessage = `Access Denied. You need the '${requiredScope}' permission. Please contact the administrator.`;
        }
        // Navigate to login page and pass the error message
        navigate("/login", {
          replace: true,
          state: { callbackError: errorMessage }, // Pass error via route state
        });
        // No need to setIsLoading(false) here as we are navigating away
      } else {
        console.error(
          "AuthCallbackPage: No valid token or status found in URL."
        );
        setError("Invalid callback state. Please try logging in again.");
        logout(); // Clear any potentially inconsistent state
        setIsLoading(false); // Stop loading to show error
        // Consider navigating to login after showing error:
        // setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    handleAuthCallback();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Render loading or error state
  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
          Processing Login...
        </Typography>
        {isLoading && <CircularProgress sx={{ mb: 2 }} />}
        {!isLoading && error && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {error}
          </Alert>
          // Optionally add a button to redirect manually
          // <Button onClick={() => navigate('/login', { replace: true })} sx={{mt: 2}}>Go to Login</Button>
        )}
      </Paper>
    </Container>
  );
};

export default AuthCallback;
