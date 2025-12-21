import { useBatchUpload } from '../hooks/useBatchUpload';
import UploadFileSelect from './batch/UploadFileSelect';
import UploadStatusTable from './batch/UploadStatusTable';

function BatchUpload() {
    const {
        files,
        uploadStatus,
        isLoadingHashes,
        processedFiles,
        totalFiles,
        handleFileSelection,
        uploadBatch
    } = useBatchUpload();

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Batch Upload Activities</h1>

            <UploadFileSelect
                isLoadingHashes={isLoadingHashes}
                onDirectorySelect={(e) => handleFileSelection(e.target.files)}
            />

            {files.length > 0 && (
                <div>
                    <div className="mb-4 flex justify-between items-center">
                        <p>Selected {files.length} files. Processed: {processedFiles}/{totalFiles}</p>
                        <button
                            onClick={uploadBatch}
                            disabled={processedFiles > 0 && processedFiles < totalFiles}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 disabled:opacity-50"
                        >
                            {processedFiles > 0 ? (processedFiles === totalFiles ? "Done" : "Start Upload") : "Start Upload"}
                        </button>
                    </div>

                    <UploadStatusTable files={files} uploadStatus={uploadStatus} />
                </div>
            )}
        </div>
    );
}

export default BatchUpload;
