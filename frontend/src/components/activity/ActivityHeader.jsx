import { FaPencil, FaTrash } from "react-icons/fa6";

const ActivityHeader = ({
    name,
    date,
    tags,
    onEdit,
    onDelete,
    isLoading
}) => {
    return (
        <>
            <div className="flex items-center space-x-4">
                <button className="edit-button" onClick={onEdit}>
                    <FaPencil />
                </button>
                <button className="delete-button" onClick={onDelete} disabled={isLoading}>
                    <FaTrash />
                </button>
            </div>
            <h1 className="activity-title">{name}</h1>
            <p className="activity-date">{date}</p>
            {tags && tags.length > 0 && (
                <div style={{ marginTop: '10px', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                    {tags.map((tag, index) => (
                        <span key={index} style={{ backgroundColor: '#f0f0f0', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9em' }}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
};

export default ActivityHeader;
