import styled from 'styled-components';

export const MetricCard = styled.div`
  background-color: #f2f2f2;
  border-radius: 6px;
  padding: 10px;
  margin: 6px;
  text-align: center;
`;

export const MetricTitle = styled.h3`
  font-size: 16px;
  margin-bottom: 6px;
`;

export const MetricValue = styled.p`
  font-size: 20px;
  font-weight: bold;
`;

export function MetricBox({name, value}) {
  return (
    <MetricCard>
      <MetricTitle>{name}</MetricTitle>
      <MetricValue>{value}</MetricValue>
    </MetricCard>
  );
}

export function Metric({name, value, unit, decimalPlaces = 0}) {
  return (
    <MetricCard>
      <MetricTitle>{name}</MetricTitle>
      <MetricValue>{`${value.toFixed(decimalPlaces)} ${unit}`}</MetricValue>
    </MetricCard>
  );
}