import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

export const useBatchUpload = () => {
    const [files, setFiles] = useState([]);
    const [uploadStatus, setUploadStatus] = useState({}); // { filename: "pending" | "uploading" | "success" | "skipped" | "error" }
    const [existingHashes, setExistingHashes] = useState(new Set());
    const [isLoadingHashes, setIsLoadingHashes] = useState(true);
    const [totalFiles, setTotalFiles] = useState(0);
    const [processedFiles, setProcessedFiles] = useState(0);

    const fetchExistingHashes = useCallback(async () => {
        try {
            const response = await apiClient.get('/activities/hashes');
            setExistingHashes(new Set(response.data));
        } catch (error) {
            console.error("Failed to fetch hashes:", error);
        } finally {
            setIsLoadingHashes(false);
        }
    }, []);

    useEffect(() => {
        fetchExistingHashes();
    }, [fetchExistingHashes]);

    const handleFileSelection = (selectedFiles) => {
        if (!selectedFiles || selectedFiles.length === 0) return;

        const validFiles = Array.from(selectedFiles).filter(file =>
            file.name.toLowerCase().endsWith('.fit') || file.name.toLowerCase().endsWith('.gpx')
        );

        setFiles(validFiles);
        setTotalFiles(validFiles.length);
        setProcessedFiles(0);

        const initialStatus = {};
        validFiles.forEach(f => initialStatus[f.name] = "pending");
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

                const response = await apiClient.post('/upload_activity', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (response.data && response.data.val_hash) {
                    existingHashes.add(response.data.val_hash);
                }
                setUploadStatus(prev => ({ ...prev, [file.name]: "success" }));

            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                setUploadStatus(prev => ({ ...prev, [file.name]: "error" }));
            }

            setProcessedFiles(prev => prev + 1);
        }
    };

    return {
        files,
        uploadStatus,
        isLoadingHashes,
        processedFiles,
        totalFiles,
        handleFileSelection,
        uploadBatch
    };
};
