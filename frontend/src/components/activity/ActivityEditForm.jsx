import { useState } from 'react';

const ActivityEditForm = ({
    initialName,
    initialDate,
    initialTags,
    onSave,
    onCancel,
    isLoading
}) => {
    // Local state for the form inputs
    const [name, setName] = useState(initialName);
    const [date, setDate] = useState(initialDate);
    const [tags, setTags] = useState(initialTags);

    const handleSave = () => {
        onSave(name, date, tags);
    };

    return (
        <div className="grid gap-6 mb-6 md:grid-cols-2">
            <div>
                <label
                    htmlFor="name"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Name
                </label>
                <input
                    type="text"
                    id="name"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div>
                <label
                    htmlFor="date"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Date
                </label>
                <input
                    type="datetime-local"
                    id="date"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    value={date?.slice(0, 16) || ""}
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>
            <div>
                <label
                    htmlFor="tags"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                    Tags (comma-separated)
                </label>
                <input
                    type="text"
                    id="tags"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    placeholder="e.g. running, outdoor, fast"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                />
            </div>
            <button
                className="py-2.5 px-5 me-2 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 items-center"
                onClick={onCancel}
                disabled={isLoading}
            >
                Cancel
            </button>
            <button
                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                onClick={handleSave}
                disabled={isLoading}
            >
                Save
            </button>
        </div>
    );
};

export default ActivityEditForm;
