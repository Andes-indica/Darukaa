import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Point,
  Polygon,
} from "geojson";
import mapboxgl from "mapbox-gl";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import "mapbox-gl/dist/mapbox-gl.css";

import type { PolygonGeometry, Position, Site } from "../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const SOURCE_ID = "darukaa-sites";
const DRAFT_SOURCE_ID = "darukaa-draft-site";

interface SiteMapProps {
  sites: Site[];
  draftBoundary: PolygonGeometry | null;
  onBoundaryChange: (boundary: PolygonGeometry | null) => void;
}

function siteCollection(sites: Site[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      id: site.id,
      properties: { name: site.name, status: site.status },
      geometry: site.boundary,
    })),
  };
}

function draftCollection(
  points: Position[],
  boundary: PolygonGeometry | null,
): FeatureCollection<Geometry> {
  const features: Array<Feature<Geometry>> = points.map((coordinates) => ({
    type: "Feature",
    properties: { kind: "vertex" },
    geometry: { type: "Point", coordinates } satisfies Point,
  }));

  if (boundary) {
    features.unshift({
      type: "Feature",
      properties: { kind: "polygon" },
      geometry: boundary,
    });
  } else if (points.length > 1) {
    features.unshift({
      type: "Feature",
      properties: { kind: "line" },
      geometry: { type: "LineString", coordinates: points } satisfies LineString,
    });
  }

  return { type: "FeatureCollection", features };
}

function setDraftData(
  map: mapboxgl.Map,
  points: Position[],
  boundary: PolygonGeometry | null,
) {
  const source = map.getSource(DRAFT_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined;
  source?.setData(draftCollection(points, boundary));
}

function updateSiteLayer(map: mapboxgl.Map, sites: Site[]) {
  const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(siteCollection(sites));

  if (sites.length) {
    const bounds = new mapboxgl.LngLatBounds();
    for (const site of sites) {
      for (const ring of site.boundary.coordinates) {
        for (const position of ring) bounds.extend(position);
      }
    }
    if (!bounds.isEmpty())
      map.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 600 });
  }
}

export function SiteMap({
  sites,
  draftBoundary,
  onBoundaryChange,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sitesRef = useRef(sites);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Position[]>([]);
  const boundaryCallbackRef = useRef(onBoundaryChange);
  const [mapReady, setMapReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  useEffect(() => {
    sitesRef.current = sites;
    if (mapRef.current?.isStyleLoaded()) updateSiteLayer(mapRef.current, sites);
  }, [sites]);

  useEffect(() => {
    boundaryCallbackRef.current = onBoundaryChange;
  }, [onBoundaryChange]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [78.9629, 20.5937],
      zoom: 4,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: siteCollection(sitesRef.current),
      });
      map.addLayer({
        id: `${SOURCE_ID}-fill`,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#2c9a67", "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: `${SOURCE_ID}-line`,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#0c6d48", "line-width": 2 },
      });

      map.addSource(DRAFT_SOURCE_ID, {
        type: "geojson",
        data: draftCollection([], null),
      });
      map.addLayer({
        id: `${DRAFT_SOURCE_ID}-fill`,
        type: "fill",
        source: DRAFT_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#f5a524", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: `${DRAFT_SOURCE_ID}-line`,
        type: "line",
        source: DRAFT_SOURCE_ID,
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
        paint: { "line-color": "#f5a524", "line-width": 3 },
      });
      map.addLayer({
        id: `${DRAFT_SOURCE_ID}-vertices`,
        type: "circle",
        source: DRAFT_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#fff7e8",
          "circle-radius": 5,
          "circle-stroke-color": "#a85d00",
          "circle-stroke-width": 2,
        },
      });

      updateSiteLayer(map, sitesRef.current);
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || drawingRef.current) return;
    setDraftData(map, [], draftBoundary);
  }, [draftBoundary]);

  function addDrawingPoint(event: ReactMouseEvent<HTMLDivElement>) {
    const map = mapRef.current;
    if (!map || !drawingRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const location = map.unproject([
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    ]);
    pointsRef.current = [
      ...pointsRef.current,
      [location.lng, location.lat],
    ];
    setPointCount(pointsRef.current.length);
    setDraftData(map, pointsRef.current, null);
  }

  function startDrawing() {
    const map = mapRef.current;
    if (!map) return;
    drawingRef.current = true;
    pointsRef.current = [];
    setIsDrawing(true);
    setPointCount(0);
    boundaryCallbackRef.current(null);
    setDraftData(map, [], null);
    map.getCanvas().style.cursor = "crosshair";
  }

  function finishDrawing() {
    const map = mapRef.current;
    if (!map || pointsRef.current.length < 3) return;
    const firstPoint = pointsRef.current[0]!;
    const boundary: PolygonGeometry = {
      type: "Polygon",
      coordinates: [[...pointsRef.current, firstPoint]],
    };
    drawingRef.current = false;
    setIsDrawing(false);
    boundaryCallbackRef.current(boundary);
    setDraftData(map, [], boundary);
    map.getCanvas().style.cursor = "";
  }

  function clearDrawing() {
    const map = mapRef.current;
    if (!map) return;
    drawingRef.current = false;
    pointsRef.current = [];
    setIsDrawing(false);
    setPointCount(0);
    boundaryCallbackRef.current(null);
    setDraftData(map, [], null);
    map.getCanvas().style.cursor = "";
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-token-message">
        <strong>Mapbox token required</strong>
        <span>
          Add `VITE_MAPBOX_TOKEN` to `.env`, then restart the frontend.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="interactive-map" ref={containerRef} />
      {isDrawing && (
        <div
          className="site-map-click-layer"
          role="application"
          aria-label="Click the map to add polygon points"
          onClick={addDrawingPoint}
        />
      )}
      <div className="site-map-tools" aria-label="Polygon drawing tools">
        <button
          type="button"
          onClick={startDrawing}
          disabled={!mapReady || isDrawing}
        >
          {isDrawing ? "Drawing…" : "Draw polygon"}
        </button>
        <button
          type="button"
          onClick={finishDrawing}
          disabled={!isDrawing || pointCount < 3}
        >
          Finish polygon
        </button>
        <button type="button" onClick={clearDrawing} disabled={!mapReady}>
          Clear
        </button>
      </div>
      {isDrawing && (
        <div className="site-map-hint" role="status">
          {pointCount < 3
            ? `Click ${3 - pointCount} more point${3 - pointCount === 1 ? "" : "s"} on the map`
            : "Add more points or click Finish polygon"}
        </div>
      )}
    </>
  );
}
