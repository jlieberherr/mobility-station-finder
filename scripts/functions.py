#!/usr/bin/python
# -*- coding: utf-8 -*-
"""This module defines the functions used in the services."""
import logging
from collections import defaultdict

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from werkzeug.exceptions import HTTPException

from params.project_params import ENCODING_UTF8, DELIMITER_SEMICOLON, CRS_EPSG_ID_WGS84, ENCODING_CP1252, PT_JT, PT_NT, \
    ROAD_JT, PT_DIST, ROAD_DIST, MATRIX
from scripts.constants import MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, MOBILITY_STATIONSSTANDORT, \
    GEOMETRY, COSTS_CHF, CHF_PER_KM_MOBILITY, MIN_PER_TRANSFER, FILTER_FACTOR, NORTHING, EASTING, NPVM_N_GEM, EPSG, \
    VTTS_CHF_PER_H_MIN, VTTS_CHF_PER_H_MAX, \
    VTTS_CHF_PER_H_STEP, CHF_PER_KM_PT, ZONE_MOBILITY_STATION, STATION_NR, STATION_NAME, ZONE_ID, \
    BEST_MOBILITY_STATIONS_COSTS_PER_VTTS, DATA_PER_ZONE, MOBILITY_STATIONS_PER_ZONE, INFOS_PER_MOBILITY_STATION
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


def get_gdf_npvm_zones(path_to_npvm_zones_shp):
    log_start("reading npvm  from {}".format(path_to_npvm_zones_shp), log)
    gdf_npvm_zones = gpd.read_file(path_to_npvm_zones_shp, encoding=ENCODING_CP1252).to_crs(CRS_EPSG_ID_WGS84)
    log_end(additional_message="# npvm zones: {}".format(len(gdf_npvm_zones)))
    return gdf_npvm_zones


def get_gdf_mobility_stations(path_to_mobility_stations_csv):
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


def get_gdf_mobility_stations_with_npvm_zone(gdf_mobility_stations, gdf_npvm_zones):
    log_start("joining mobility stations with npvm zones", log)
    gdf_mobility_stations_with_npvm_zone = gpd.sjoin(gdf_mobility_stations, gdf_npvm_zones)[
        [MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, GEOMETRY, EASTING, NORTHING]]
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


def calc_costs_df(df_data, vtts, pt_min_per_transfer, pt_chf_per_km, road_chf_per_km):
    return vtts / 60 * (df_data[PT_JT] + pt_min_per_transfer * df_data[PT_NT] +
                        df_data[ROAD_JT]) + pt_chf_per_km * df_data[PT_DIST] + road_chf_per_km * df_data[ROAD_DIST]


def get_relevant_mob_stations(df_mobility_stations_per_vtts):
    relevant_mob_stations = []
    for df_ in df_mobility_stations_per_vtts.values():
        relevant_mob_stations += df_['zone_mobility_station'].to_list()
    relevant_mob_stations = set(relevant_mob_stations)
    return relevant_mob_stations


def run_query(orig_easting_northing, dest_easting_northing,
              gdf_zones,
              gdf_mobility_stations_with_npvm_zone,
              pt_jt, pt_nt, pt_dist, road_jt, road_dist,
              vtts_min=VTTS_CHF_PER_H_MIN, vtts_max=VTTS_CHF_PER_H_MAX, vtts_step=VTTS_CHF_PER_H_STEP,
              min_per_transfer=MIN_PER_TRANSFER, pt_chf_per_km=CHF_PER_KM_PT, road_chf_per_km=CHF_PER_KM_MOBILITY,
              filter_factor=FILTER_FACTOR
              ):
    log_start("searching best mobility stations from {} to {}".format(orig_easting_northing, dest_easting_northing),
              log)
    gdf_orig_with_npvm_zone_id = get_gdf_point_with_zone_id(orig_easting_northing, gdf_zones)
    if len(gdf_orig_with_npvm_zone_id) == 0:
        raise OriginNotInNPVMAreaError("no zone found for origin: {}".format(orig_easting_northing))
    gdf_dest_with_npvm_zone_id = get_gdf_point_with_zone_id(dest_easting_northing, gdf_zones)
    if len(gdf_dest_with_npvm_zone_id) == 0:
        raise DestinationNotInNPVMAreaError("no zone found for destination: {}".format(dest_easting_northing))
    from_zone_id = get_zone_id(gdf_orig_with_npvm_zone_id)
    to_zone_id = get_zone_id(gdf_dest_with_npvm_zone_id)

    # filter pt matrices to origin
    pt_jt = pt_jt.sel(origins=from_zone_id, drop=True).matrix
    pt_nt = pt_nt.sel(origins=from_zone_id, drop=True).matrix
    pt_dist = pt_dist.sel(origins=from_zone_id, drop=True).matrix
    # filter road matrices to destination
    road_jt = road_jt.sel(destinations=to_zone_id, drop=True).matrix
    road_dist = road_dist.sel(destinations=to_zone_id, drop=True).matrix

    # put into Pandas DataFrames
    df_pt_jt = pt_jt.to_dataframe().reset_index().rename(columns={MATRIX: PT_JT})
    df_pt_nt = pt_nt.to_dataframe().reset_index().rename(columns={MATRIX: PT_NT})
    df_pt_dist = pt_dist.to_dataframe().reset_index().rename(columns={MATRIX: PT_DIST})
    df_road_jt = road_jt.to_dataframe().reset_index().rename(columns={MATRIX: ROAD_JT})
    df_road_dist = road_dist.to_dataframe().reset_index().rename(columns={MATRIX: ROAD_DIST})

    # merge into one DataFrame
    df_data = df_pt_jt
    for df in [df_pt_nt, df_pt_dist, df_road_jt, df_road_dist]:
        df_data = df_data.merge(df)

    # calculate the best mobility stations per value of travel time savings
    best_mobility_stations_costs_per_vtts = {}
    for vtts in range(vtts_min, vtts_max, vtts_step):
        df_data[COSTS_CHF] = calc_costs_df(df_data, vtts, min_per_transfer, pt_chf_per_km, road_chf_per_km)
        min_costs = df_data[COSTS_CHF].min()
        best_mobility_stations_costs_per_vtts[vtts] = df_data[[ZONE_MOBILITY_STATION, COSTS_CHF]][
            df_data[COSTS_CHF] <= filter_factor * min_costs]

    # get relevant mobility stations into one set
    relevant_mob_stations = get_relevant_mob_stations(best_mobility_stations_costs_per_vtts)

    # prepare output
    data_per_zone = df_data[df_data.zone_mobility_station.isin(relevant_mob_stations)].to_dict('records')
    data_per_zone = {x[ZONE_MOBILITY_STATION]: x for x in data_per_zone}

    mob_stations_per_npvm_zone = defaultdict(list)
    infos_per_mob_station = {}
    for e in gdf_mobility_stations_with_npvm_zone[
        gdf_mobility_stations_with_npvm_zone.ID.isin(relevant_mob_stations)].to_dict('records'):
        mob_st_nr = e['Stationsnummer']
        mob_st_name = e['Name']
        zone_id = e['ID']
        easting = e[EASTING]
        northing = e[NORTHING]
        mob_stations_per_npvm_zone[zone_id] += [mob_st_nr]
        if mob_st_nr in infos_per_mob_station:
            raise ValueError('something wrong')
        infos_per_mob_station[mob_st_nr] = {
            STATION_NR: mob_st_nr,
            STATION_NAME: mob_st_name,
            ZONE_ID: zone_id,
            EASTING: easting,
            NORTHING: northing
        }
    log_end()
    return {
        BEST_MOBILITY_STATIONS_COSTS_PER_VTTS: {k: df.to_dict('records') for k, df in
                                                best_mobility_stations_costs_per_vtts.items()},
        DATA_PER_ZONE: data_per_zone,
        MOBILITY_STATIONS_PER_ZONE: dict(mob_stations_per_npvm_zone),
        INFOS_PER_MOBILITY_STATION: infos_per_mob_station
    }
