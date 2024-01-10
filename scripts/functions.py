#!/usr/bin/python
# -*- coding: utf-8 -*-
"""This module defines the functions used in the services."""
import logging
from math import radians, sin, cos, atan2, sqrt

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point
from werkzeug.exceptions import HTTPException

from params.project_params import ENCODING_UTF8, DELIMITER_SEMICOLON, CRS_EPSG_ID_WGS84, ENCODING_CP1252, PT_JT, PT_NT, \
    ROAD_JT, PT_DIST, ROAD_DIST, MATRIX
from scripts.constants import MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, MOBILITY_STATIONSSTANDORT, \
    GEOMETRY, COSTS_CHF, CHF_PER_KM_MOBILITY, MIN_PER_TRANSFER, FIRST_FILTER_FACTOR, NORTHING, EASTING, NPVM_N_GEM, \
    EPSG, \
    VTTS_CHF_PER_H_MIN, VTTS_CHF_PER_H_MAX, \
    VTTS_CHF_PER_H_STEP, CHF_PER_KM_PT, ZONE_ID_MOBILITY_STATION, MOBILITY_STATIONS_COSTS_PER_VTTS, \
    DATA_PER_MOBILITY_STATION_ID, DISTANCES, \
    DURATIONS, EARTH_RADIUS, SECOND_FILTER_FACTOR, FACTOR_NOT_FOOT, PENALTY_IN_MIN_NOT_FOOT, FOOT_AREA_KM, NPVM_N_KT, \
    BEST_STATIONS_PER_VTTS
from scripts.helpers.my_logging import log_start, log_end

log = logging.getLogger(__name__)


class OriginNotInNPVMAreaError(HTTPException):
    """Raised when the origin is not in the NPVM areas."""
    code = 550
    description = "Origin not in NPVM area."


class DestinationNotInNPVMAreaError(HTTPException):
    """Raised when the destination is not in the NPVM areas."""
    code = 551
    description = "Destination not in NPVM area."


class RoadRoutingError(HTTPException):
    """Raised when the road routing fails."""
    code = 552
    description = "Road routing error."


fields_zones = [NPVM_ID, GEOMETRY, NPVM_N_GEM, NPVM_N_KT]


def get_gdf_npvm_zones(path_to_npvm_zones_shp):
    log_start("reading npvm  from {}".format(path_to_npvm_zones_shp), log)
    gdf_npvm_zones = gpd.read_file(path_to_npvm_zones_shp, encoding=ENCODING_CP1252).to_crs(CRS_EPSG_ID_WGS84)[
        fields_zones]
    log_end(additional_message="# npvm zones: {}".format(len(gdf_npvm_zones)))
    return gdf_npvm_zones


def get_mobility_stations_from_api():
    url_stations = r"https://sharedmobility.ch/station_information.json"
    log_start(f"reading mobility stations from {url_stations}", log)
    res = requests.get(url_stations).json()
    mob_stations = []
    geometry = []
    for s in res['data']['stations']:
        if s['provider_id'] in ["mobility", "emobility"]:
            easting = s['lon']
            northing = s['lat']
            mob_stations += [
                {MOBILITY_STATIONSNUMMER: s['station_id'].split(':')[1],
                 MOBILITY_STATIONSNAME: s['name'],
                 EASTING: easting, NORTHING: northing, }]
            geometry += [Point(easting, northing)]
    gdf_mobility_stations = gpd.GeoDataFrame(mob_stations, geometry=geometry, crs=CRS_EPSG_ID_WGS84)
    gdf_mobility_stations = gdf_mobility_stations.drop_duplicates()
    log_end(additional_message="# mobility stations: {}".format(len(gdf_mobility_stations)))
    return gdf_mobility_stations


def get_gdf_mobility_stations_from_file(path_to_mobility_stations_csv):
    log_start("reading mobility stations from {}".format(path_to_mobility_stations_csv), log)
    df_mobility_vehicles = \
        pd.read_csv(path_to_mobility_stations_csv, delimiter=DELIMITER_SEMICOLON, encoding=ENCODING_UTF8)[
            [MOBILITY_STATIONSNUMMER, MOBILITY_STATIONSNAME, MOBILITY_STATIONSSTANDORT]].dropna()
    df_mobility_stations = df_mobility_vehicles.groupby(MOBILITY_STATIONSNUMMER).first().reset_index()
    df_mobility_stations[EASTING] = df_mobility_stations[MOBILITY_STATIONSSTANDORT].apply(lambda x: x.split(",")[1])
    df_mobility_stations[NORTHING] = df_mobility_stations[MOBILITY_STATIONSSTANDORT].apply(lambda x: x.split(",")[0])
    gdf_mobility_stations = gpd.GeoDataFrame(df_mobility_stations,
                                             geometry=gpd.points_from_xy(df_mobility_stations.easting,
                                                                         df_mobility_stations.northing),
                                             crs=CRS_EPSG_ID_WGS84)
    log_end(additional_message="# mobility stations: {}".format(len(gdf_mobility_stations)))
    return gdf_mobility_stations


field_stations = [MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, EASTING, NORTHING]


def get_gdf_mobility_stations_with_npvm_zone(gdf_mobility_stations, gdf_npvm_zones):
    log_start("joining mobility stations with npvm zones", log)
    gdf_mobility_stations_with_npvm_zone = gpd.sjoin(gdf_mobility_stations, gdf_npvm_zones)[field_stations]
    log_end(
        additional_message="# mobility stations with npvm zone: {}".format(len(gdf_mobility_stations_with_npvm_zone)))
    return gdf_mobility_stations_with_npvm_zone


def get_gdf_point_with_zone_id(point_easting_northing, gdf_zones):
    log_start(f"getting zone id for point {point_easting_northing}", log)
    point = Point(point_easting_northing[0], point_easting_northing[1])
    gdf_point = gpd.GeoDataFrame({GEOMETRY: [point]}, crs="{}:{}".format(EPSG, CRS_EPSG_ID_WGS84))
    gdf_point_with_zone = gpd.sjoin(gdf_point, gdf_zones)[[NPVM_ID, NPVM_N_GEM, GEOMETRY]]
    log_end()
    return gdf_point_with_zone


def get_zone_id(gdf_point_with_npvm_zone_id):
    if len(gdf_point_with_npvm_zone_id) != 1:
        raise ValueError("only one entry expected, but there are {}".format(len(gdf_point_with_npvm_zone_id)))
    return gdf_point_with_npvm_zone_id[NPVM_ID].item()


def calc_costs_df(df_data, vtts, pt_min_per_transfer, pt_chf_per_km, road_chf_per_km, penalty_not_foot):
    return vtts / 60 * (
            penalty_not_foot * df_data[FACTOR_NOT_FOOT] + df_data[PT_JT] + pt_min_per_transfer * df_data[PT_NT] +
            df_data[ROAD_JT]) + pt_chf_per_km * df_data[PT_DIST] + road_chf_per_km * df_data[ROAD_DIST]


def get_relevant_stations(best_stations_per_vtts):
    relevant_stations = []
    for stations in best_stations_per_vtts.values():
        relevant_stations += stations
    relevant_stations = set(relevant_stations)
    return relevant_stations


def execute_road_routing(list_stations, gdf_dest_with_zone_id, chunk_size=200):
    log_start("executing road routing. # mobility stations: {}".format(len(list_stations)), log)
    road_distances_from_stat_to_dest_per_station_id = {}
    road_durations_from_stat_to_dest_per_station_id = {}
    chunks_stations = [list_stations[i:i + chunk_size] for i in
                       range(0, len(list_stations), chunk_size)]
    log.info("number of road routing chunks: {}".format(len(chunks_stations)))
    for nr, chunk in enumerate(chunks_stations):
        log_start(
            "road routing chunk {}/{}, # = {}".format(nr + 1, len(chunks_stations), len(chunk)), log)
        coords_str = "{},{}".format(gdf_dest_with_zone_id[GEOMETRY].x.item(),
                                    gdf_dest_with_zone_id[GEOMETRY].y.item())
        for st in chunk:
            coords_str += ";{},{}".format(st[EASTING], st[NORTHING])
        url = "https://router.project-osrm.org/table/v1/driving/{}?destinations=0&annotations=duration,distance".format(
            coords_str)
        res = requests.get(url).json()
        for n, x in enumerate(chunk):
            road_distances_from_stat_to_dest_per_station_id[x[MOBILITY_STATIONSNUMMER]] = res[DISTANCES][n + 1][
                                                                                              0] / 1000.0
            road_durations_from_stat_to_dest_per_station_id[x[MOBILITY_STATIONSNUMMER]] = res[DURATIONS][n + 1][
                                                                                              0] / 60.0
        log_end()
    log_end()
    return road_distances_from_stat_to_dest_per_station_id, road_durations_from_stat_to_dest_per_station_id


fields = [MOBILITY_STATIONSNUMMER, MOBILITY_STATIONSNAME, ZONE_ID_MOBILITY_STATION,
          PT_JT, PT_NT, PT_DIST,
          ROAD_JT, ROAD_DIST,
          EASTING, NORTHING]


def calc_distance(easting_1, northing_1, easting_2, northing_2):
    """calculates the distance between two points in kilometers"""
    lat1 = radians(northing_1)
    lon1 = radians(easting_1)
    lat2 = radians(northing_2)
    lon2 = radians(easting_2)
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = EARTH_RADIUS * c
    return distance


def remove_top_vvts_with_no_changes(best_stations_per_vtts_):
    """removes the top vtts such that from the highest to second highest vtts the set of station is different"""
    vtts_descending = sorted(best_stations_per_vtts_.keys(), reverse=True)
    last_stations = set(best_stations_per_vtts_[vtts_descending[0]])
    last_vtts = vtts_descending[0]
    for vtts in vtts_descending[1:]:
        stations = set(best_stations_per_vtts_[vtts])
        if stations == last_stations:
            del best_stations_per_vtts_[last_vtts]
            last_stations = stations
            last_vtts = vtts
        else:
            break


def run_query(orig_easting_northing, dest_easting_northing,
              gdf_zones,
              gdf_stations_with_zone,
              pt_jt, pt_nt, pt_dist, road_jt, road_dist,
              vtts_min=VTTS_CHF_PER_H_MIN, vtts_max=VTTS_CHF_PER_H_MAX, vtts_step=VTTS_CHF_PER_H_STEP,
              min_per_transfer=MIN_PER_TRANSFER, pt_chf_per_km=CHF_PER_KM_PT, road_chf_per_km=CHF_PER_KM_MOBILITY,
              penalty_not_foot=PENALTY_IN_MIN_NOT_FOOT,
              first_filter_factor=FIRST_FILTER_FACTOR,
              second_filter_factor=SECOND_FILTER_FACTOR
              ):
    """runs the query for the given origin and destination and returns the result as a dict"""
    log_start("searching best mobility stations from {} to {}".format(orig_easting_northing, dest_easting_northing),
              log)
    gdf_orig_with_zone_id = get_gdf_point_with_zone_id(orig_easting_northing, gdf_zones)
    if len(gdf_orig_with_zone_id) == 0:
        raise OriginNotInNPVMAreaError("no zone found for origin: {}".format(orig_easting_northing))
    gdf_dest_with_zone_id = get_gdf_point_with_zone_id(dest_easting_northing, gdf_zones)
    if len(gdf_dest_with_zone_id) == 0:
        raise DestinationNotInNPVMAreaError("no zone found for destination: {}".format(dest_easting_northing))
    from_zone_id = get_zone_id(gdf_orig_with_zone_id)
    to_zone_id = get_zone_id(gdf_dest_with_zone_id)

    # filter pt matrices from origin to stations
    pt_jt = pt_jt.sel(origins=from_zone_id, drop=True).matrix
    pt_nt = pt_nt.sel(origins=from_zone_id, drop=True).matrix
    pt_dist = pt_dist.sel(origins=from_zone_id, drop=True).matrix
    # filter road matrices from stations to destination
    road_jt = road_jt.sel(destinations=to_zone_id, drop=True).matrix
    road_dist = road_dist.sel(destinations=to_zone_id, drop=True).matrix

    # put matrices into Pandas DataFrames
    df_pt_jt = pt_jt.to_dataframe().reset_index().rename(columns={MATRIX: PT_JT})
    df_pt_nt = pt_nt.to_dataframe().reset_index().rename(columns={MATRIX: PT_NT})
    df_pt_dist = pt_dist.to_dataframe().reset_index().rename(columns={MATRIX: PT_DIST})
    df_road_jt = road_jt.to_dataframe().reset_index().rename(columns={MATRIX: ROAD_JT})
    df_road_dist = road_dist.to_dataframe().reset_index().rename(columns={MATRIX: ROAD_DIST})

    # merge into one DataFrame
    df_data = df_pt_jt
    for df in [df_pt_nt, df_pt_dist, df_road_jt, df_road_dist]:
        df_data = df_data.merge(df)
    # merge with stations
    df_data = df_data.merge(gdf_stations_with_zone, left_on=ZONE_ID_MOBILITY_STATION, right_on=NPVM_ID)[fields]

    def calc_not_foot_penalty(x):
        """calculates the penalty for not being accessible by foot as a factor between 0 and 1"""
        dist = calc_distance(orig_easting_northing[0], orig_easting_northing[1], float(x["easting"]),
                             float(x["northing"]))
        return min(dist / FOOT_AREA_KM, 1.0)

    # penalty for not being accessible by foot
    df_data[FACTOR_NOT_FOOT] = df_data.apply(calc_not_foot_penalty, axis=1)

    def get_relevant_stations_per_vtts_costs_per_vtts(vtts_min_, vtts_max_, vtts_step_, filter_factor):
        stations_costs_per_vtts_ = {}
        best_stations_per_vtts_ = {}
        for vtts in range(vtts_min_, vtts_max_, vtts_step_):
            df_data[COSTS_CHF] = calc_costs_df(df_data, vtts, min_per_transfer, pt_chf_per_km, road_chf_per_km,
                                               penalty_not_foot)
            stations_costs_per_vtts_[vtts] = df_data[[MOBILITY_STATIONSNUMMER, COSTS_CHF]]
            min_costs = df_data[COSTS_CHF].min()
            best_stations_per_vtts_[vtts] = df_data[df_data[COSTS_CHF] <= filter_factor * min_costs][
                MOBILITY_STATIONSNUMMER].tolist()
        return stations_costs_per_vtts_, best_stations_per_vtts_

    # calculate the best stations per value of travel time savings based on npvm pt and road matrices
    while True:
        # loop until not more than 200 stations are left (osrm matrix routing accepts max 200 stations)
        stations_costs_per_vtts, best_stations_per_vtts = get_relevant_stations_per_vtts_costs_per_vtts(vtts_min,
                                                                                                        vtts_max,
                                                                                                        vtts_step,
                                                                                                        first_filter_factor)
        relevant_stations = get_relevant_stations(best_stations_per_vtts)
        if len(relevant_stations) <= 200:  # osrm matrix routing accepts max approximately 200 stations
            break
        else:
            log.info(f"with filter factor {first_filter_factor} too much stations {len(relevant_stations)}")
            first_filter_factor -= 0.01

    # get road distances and durations from potential mobility stations to destination (by osrm car routing)
    # this step is only necessary since the osrm matrix routing accept max 200 stations
    # if the osrm matrix routing would be done locally this step could be skipped (potentially)
    df_data_relevant_stations = df_data[df_data[MOBILITY_STATIONSNUMMER].isin(relevant_stations)]
    list_relevant_stations_for_road_routing = list(
        df_data_relevant_stations[[MOBILITY_STATIONSNUMMER, EASTING, NORTHING]].to_dict("records"))
    try:
        road_dist_from_station_to_dest_per_station_id, road_durations_from_station_to_dest_per_station_id = \
            execute_road_routing(list_relevant_stations_for_road_routing, gdf_dest_with_zone_id)
    except Exception:
        raise RoadRoutingError(
            "could not get road distances and durations from potential mobility stations to destination")

    # merge road distances and durations into DataFrame
    pd_distances = pd.DataFrame(list(road_dist_from_station_to_dest_per_station_id.items()),
                                columns=[MOBILITY_STATIONSNUMMER, ROAD_DIST])
    pd_durations = pd.DataFrame(list(road_durations_from_station_to_dest_per_station_id.items()),
                                columns=[MOBILITY_STATIONSNUMMER, ROAD_JT])
    df_data_relevant_stations = df_data_relevant_stations.drop([ROAD_DIST, ROAD_JT], axis=1)
    df_data_relevant_stations = df_data_relevant_stations.merge(pd_distances, on=MOBILITY_STATIONSNUMMER)
    df_data_relevant_stations = df_data_relevant_stations.merge(pd_durations, on=MOBILITY_STATIONSNUMMER)

    # recalculate the best stations per value of travel time savings,
    # now with road distances and durations from osrm routing
    # and a stricter filter criterion.
    stations_costs_per_vtts, best_stations_per_vtts = get_relevant_stations_per_vtts_costs_per_vtts(vtts_min,
                                                                                                    vtts_max,
                                                                                                    vtts_step,
                                                                                                    second_filter_factor)

    remove_top_vvts_with_no_changes(best_stations_per_vtts)
    # filter the DataFrame to only contain the relevant stations
    relevant_stations = get_relevant_stations(best_stations_per_vtts)
    df_data_relevant_stations = df_data_relevant_stations[
        df_data_relevant_stations.Stationsnummer.isin(relevant_stations)]

    # prepare output
    data_per_station_id = df_data_relevant_stations.to_dict('records')
    data_per_station_id = {x[MOBILITY_STATIONSNUMMER]: x for x in data_per_station_id}
    relevant_stations_costs_per_vtts = {k: v[v[MOBILITY_STATIONSNUMMER].isin(relevant_stations)] for k, v in
                                        stations_costs_per_vtts.items() if k in best_stations_per_vtts.keys()}

    log.info(f'# mobility stations: {len(data_per_station_id)}')
    log_end()
    return {
        MOBILITY_STATIONS_COSTS_PER_VTTS: {k: df.to_dict('records') for k, df in
                                           relevant_stations_costs_per_vtts.items()},
        DATA_PER_MOBILITY_STATION_ID: data_per_station_id,
        BEST_STATIONS_PER_VTTS: best_stations_per_vtts,
    }
