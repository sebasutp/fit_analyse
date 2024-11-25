import PowerCdfPlot from './PowerCdfPlot';
import {Metric} from '../MetricComponents'

const PowerCard = ({ powerSummary }) => {
  return (
    <div className="card-container">
      <h2 className="card-title">Power</h2>
      <div className="two-col-container">
        <Metric name="Average Power" value={powerSummary.average_power} unit="W" />
        <Metric name="Median Power" value={powerSummary.median_power} unit="W" />
        <Metric name="Total Work" value={powerSummary.total_work} unit="J" />
      </div>
      <PowerCdfPlot powerQuantiles={powerSummary.quantiles} />
    </div>
  );
}

export default PowerCard;