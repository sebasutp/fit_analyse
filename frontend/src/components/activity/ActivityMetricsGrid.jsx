import { Metric, MetricBox } from '../MetricComponents';
import { getElapsedTime } from '../Utils';

function ActivityMetricsGrid({ activityAnalysis }) {
    if (!activityAnalysis) return null;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 dark:text-gray-200">
            <Metric
                name="Distance"
                value={activityAnalysis.distance}
                unit="km"
                decimalPlaces={1}
            />
            <Metric
                name="Average Speed"
                value={activityAnalysis.average_speed}
                unit="km/h"
                decimalPlaces={1}
            />
            <Metric
                name="Elevation gain"
                value={activityAnalysis.elevation_gain}
                unit="m"
            />
            <MetricBox
                name="Elapsed time"
                value={getElapsedTime(activityAnalysis.total_elapsed_time)}
            />
        </div>
    );
}

export default ActivityMetricsGrid;
