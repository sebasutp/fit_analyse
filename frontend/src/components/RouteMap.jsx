import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";

import msgpack from "msgpack-lite";
import { useParams } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import loadingImg from "../assets/loading.gif";

function RouteMap() {
  const { id } = useParams();
  const [polylinePoints, setPolylinePoints] = useState([]);
  const [is_loading_raw_activity, setIsLoadingRawActivity] = useState(true);
  const [mapCenter, setMapCenter] = useState([]);

  function setMapCenterFromRoute(latitudes, longitudes) {
    const lat = latitudes.filter((x) => !isNaN(x));
    const long = longitudes.filter((x) => !isNaN(x));
    // Calculate bounding box
    const minLat = Math.min(...lat);
    const maxLat = Math.max(...lat);
    const minLng = Math.min(...long);
    const maxLng = Math.max(...long);

    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    setMapCenter([centerLat, centerLng]);
  }

  useEffect(() => {
    setIsLoadingRawActivity(true);
    fetch(
      `${
        import.meta.env.VITE_BACKEND_URL
      }/activity/${id}/raw?columns=position_lat,position_long`
    )
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => {
        const decodedArray = msgpack.decode(new Uint8Array(arrayBuffer));
        setMapCenterFromRoute(
          decodedArray["position_lat"],
          decodedArray["position_long"]
        );
        const points = decodedArray["position_lat"]
          .map((lat, index) => [lat, decodedArray["position_long"][index]])
          .filter((pair) => !isNaN(pair[0]) && !isNaN(pair[1]));
        setPolylinePoints(points);
        setIsLoadingRawActivity(false);
      });
  }, [id]);

  return (
    <div>
      {is_loading_raw_activity ? (
        <img src={loadingImg} alt="Loading..." />
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={12}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={polylinePoints} color="blue" weight={5} />
        </MapContainer>
      )}
    </div>
  );
}

export default RouteMap;
