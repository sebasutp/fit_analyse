
export function ActivityCard({activity}) {
    return (
      <div className="card-container">
        <a href={`./activity/${activity.activity_id}`} className="card-title">{activity.name}</a>
      </div>
    );
  };