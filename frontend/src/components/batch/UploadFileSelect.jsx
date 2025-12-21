function UploadFileSelect({ isLoadingHashes, onDirectorySelect }) {
    if (isLoadingHashes) {
        return <p>Loading existing activity data...</p>;
    }

    return (
        <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white" htmlFor="folder_input">
                Select Folder (containing .fit or .gpx files)
            </label>
            <input
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                id="folder_input"
                type="file"
                webkitdirectory=""
                directory=""
                onChange={onDirectorySelect}
            />
        </div>
    );
}

export default UploadFileSelect;
