export function MetricBox({ name, value }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center flex flex-col justify-center min-w-0">
      <h3 className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 truncate" title={name}>
        {name}
      </h3>
      <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
        {value}
      </p>
    </div>
  );
}

export function Metric({ name, value, unit, decimalPlaces = 0 }) {
  const formattedValue = typeof value === 'number' ? value.toFixed(decimalPlaces) : value;
  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center flex flex-col justify-center min-w-0">
      <h3 className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 truncate" title={name}>
        {name}
      </h3>
      <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
        {`${formattedValue} `}<span className="text-xs sm:text-sm font-normal text-gray-500">{unit}</span>
      </p>
    </div>
  );
}