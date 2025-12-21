function UploadStatusTable({ files, uploadStatus }) {
    return (
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
    );
}

export default UploadStatusTable;
