import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetToken, ParseBackendResponse } from './Utils';
import loadingImg from '../assets/loading.gif';

function BatchUpload() {
    const [files, setFiles] = useState([]);
    const [uploadStatus, setUploadStatus] = useState({}); // { filename: "pending" | "uploading" | "success" | "skipped" | "error" }
    const [existingHashes, setExistingHashes] = useState(new Set());
    const [isLoadingHashes, setIsLoadingHashes] = useState(true);
    const [totalFiles, setTotalFiles] = useState(0);
    const [processedFiles, setProcessedFiles] = useState(0);

    const token = GetToken();
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch existing hashes on mount
        const url = `${import.meta.env.VITE_BACKEND_URL}/activities/hashes`;
        fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then((response) => response.json())
            .then((data) => {
                setExistingHashes(new Set(data));
                setIsLoadingHashes(false);
            })
            .catch((error) => {
                console.error("Failed to fetch hashes:", error);
                setIsLoadingHashes(false);
            });
    }, [token]);

    const handleDirectorySelect = (event) => {
        const selectedFiles = Array.from(event.target.files).filter(file =>
            file.name.toLowerCase().endsWith('.fit') || file.name.toLowerCase().endsWith('.gpx')
        );
        setFiles(selectedFiles);
        setTotalFiles(selectedFiles.length);
        setProcessedFiles(0);
        const initialStatus = {};
        selectedFiles.forEach(f => initialStatus[f.name] = "pending");
        setUploadStatus(initialStatus);
    };

    const calculateHash = async (file) => {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    const uploadBatch = async () => {
        const url = `${import.meta.env.VITE_BACKEND_URL}/upload_activity`;

        for (const file of files) {
            setUploadStatus(prev => ({ ...prev, [file.name]: "hashing" }));

            try {
                const hash = await calculateHash(file);

                if (existingHashes.has(hash)) {
                    setUploadStatus(prev => ({ ...prev, [file.name]: "skipped" }));
                    setProcessedFiles(prev => prev + 1);
                    continue;
                }

                setUploadStatus(prev => ({ ...prev, [file.name]: "uploading" }));

                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(url, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // If the backend returns an activity that has a hash that matches our file, update our local set
                    if (data.val_hash) {
                        existingHashes.add(data.val_hash);
                    }
                    setUploadStatus(prev => ({ ...prev, [file.name]: "success" }));
                } else {
                    setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
                }

            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
            }

            setProcessedFiles(prev => prev + 1);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Batch Upload Activities</h1>

            {isLoadingHashes ? (
                <p>Loading existing activity data...</p>
            ) : (
                <div className="mb-4">
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white" htmlFor="folder_input">Select Folder (containing .fit or .gpx files)</label>
                    <input
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                        id="folder_input"
                        type="file"
                        webkitdirectory=""
                        directory=""
                        onChange={handleDirectorySelect}
                    />
                </div>
            )}

            {files.length > 0 && (
                <div>
                    <div className="mb-4 flex justify-between items-center">
                        <p>Selected {files.length} files. Processed: {processedFiles}/{totalFiles}</p>
                        <button
                            onClick={uploadBatch}
                            disabled={processedFiles > 0 && processedFiles < totalFiles} // Disable while running
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 disabled:opacity-50"
                        >
                            {processedFiles > 0 ? (processedFiles === totalFiles ? "Done" : "Uploading...") : "Start Upload"}
                        </button>
                    </div>

                    <div className="relative overflow-x-auto shadow-md sm:rounded-lg max-h-96">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">File Name</th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map(file => (
                                    <tr key={file.name} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                            {file.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            {uploadStatus[file.name] === 'pending' && <span className="text-gray-500">Pending</span>}
                                            {uploadStatus[file.name] === 'hashing' && <span className="text-blue-500">Hashing...</span>}
                                            {uploadStatus[file.name] === 'uploading' && <span className="text-blue-500">Uploading...</span>}
                                            {uploadStatus[file.name] === 'skipped' && <span className="text-yellow-500">Skipped (Duplicate)</span>}
                                            {uploadStatus[file.name] === 'success' && <span className="text-green-500">Success</span>}
                                            {uploadStatus[file.name] === 'error' && <span className="text-red-500">Error</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BatchUpload;
