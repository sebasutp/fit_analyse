import propTypes from "prop-types";

import PowerCdfPlot from "./PowerCdfPlot";
import { Metric } from "../MetricComponents";

const PowerCard = ({ powerSummary }) => {
  return (
    <div className="card-container">
      <h2 className="card-title">Power</h2>
      <div className="two-col-container">
        {powerSummary?.average_power && (
          <Metric
            name="Average Power"
            value={powerSummary.average_power}
            unit="W"
          />
        )}
        {powerSummary?.median_power && (
          <Metric
            name="Median Power"
            value={powerSummary.median_power}
            unit="W"
          />
        )}
        {powerSummary?.total_work && (
          <Metric name="Total Work" value={powerSummary.total_work} unit="J" />
        )}
      </div>
      {powerSummary?.quantiles && (
        <PowerCdfPlot powerQuantiles={powerSummary.quantiles} />
      )}
    </div>
  );
};

PowerCard.propTypes = {
  powerSummary: propTypes.object,
};

export default PowerCard;
