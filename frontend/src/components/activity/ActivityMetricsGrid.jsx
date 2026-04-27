import { Metric, MetricBox } from '../MetricComponents';
import { getElapsedTime } from '../Utils';

function ActivityMetricsGrid({ activityAnalysis }) {
    if (!activityAnalysis) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 w-full">
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
            {activityAnalysis.average_heartrate && (
                <Metric
                    name="Average HR"
                    value={activityAnalysis.average_heartrate}
                    unit="bpm"
                />
            )}
            {activityAnalysis.max_heartrate && (
                <Metric
                    name="Max HR"
                    value={activityAnalysis.max_heartrate}
                    unit="bpm"
                />
            )}
            {activityAnalysis.average_temperature != null && (
                <Metric
                    name="Temperature"
                    value={activityAnalysis.average_temperature}
                    unit="°C"
                    decimalPlaces={1}
                />
            )}
        </div>
    );

}

export default ActivityMetricsGrid;
