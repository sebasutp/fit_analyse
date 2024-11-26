
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetToken, ParseBackendResponse } from './Utils';

function NewActivity() {
  const [is_loading, setIsLoading] = useState(false);

  const token = GetToken();
  const navigate = useNavigate();

  const uploadFitFile = (file) => {
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const url = `${import.meta.env.VITE_BACKEND_URL}/upload_activity`;

    // Send the FormData to the backend
    fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`
        }
    })
    .then((response) => ParseBackendResponse(response, navigate))
    .then((data) => {
      console.log("Successfully added activity: ", data);
      setIsLoading(false);
      navigate(`/activity/${data.activity_id}`);
    })
    .catch(error => {
        // Handle error
    });
  }

  return (
    <div>
      {is_loading ? 
        (
          <img src='/assets/loading.gif' alt="Loading..." />
        ) : 
        (
          <div>
            <label>Upload Fit file</label>
            <input type="file" onChange={(e) => uploadFitFile(e.target.files[0])} />
          </div>
        )
      }
    </div>
  );
}

export default NewActivity;