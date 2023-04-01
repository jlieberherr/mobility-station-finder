#!/usr/bin/python
# -*- coding: utf-8 -*-
"""This module defines the functions used in the services."""
import logging

import pandas as pd
import geopandas as gpd
import requests
from matrixconverters.read_ptv import ReadPTVMatrix
from shapely.geometry import Point

from params.project_params import ENCODING_UTF8, DELIMITER_SEMICOLON, CRS_EPSG_ID_WGS84, ENCODING_CP1252
from scripts.constants import MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, MOBILITY_STATIONSSTANDORT, \
    LONGITUDE, LATITUDE, GEOMETRY, DISTANCES, DURATIONS, MIV_DISTANZ_BIS_ZIEL_KM, MIV_ZEIT_BIS_ZIEL_MIN, \
    OEV_JRTA_VON_START_MIN, OEV_NTR_VON_START, KOSTEN_CHF, CHF_PER_KM_MOBILITY, MIN_PER_TRANSFER, OUTPUT_TYPE_GDF, \
    FILTER_FACTOR, OUTPUT_TYPE_DICT, NORTHING, EASTING, NPVM_N_GEM, EPSG
from scripts.helpers.my_logging import log_start, log_end

log = logging.getLogger(__name__)


def get_gdf_npvm_zones(path_to_npvm_zones_shp):
    log_start("reading npvm  from {}".format(path_to_npvm_zones_shp), log)
    gdf_npvm_zones = gpd.read_file(path_to_npvm_zones_shp, encoding=ENCODING_CP1252).to_crs(CRS_EPSG_ID_WGS84)
    log_end(additional_message="# npvm zones: {}".format(len(gdf_npvm_zones)))
    return gdf_npvm_zones


def get_gdf_mobilty_stations(path_to_mobility_stations_csv):
    log_start("reading mobility stations from {}".format(path_to_mobility_stations_csv), log)
    df_mobility_vechicles = \
        pd.read_csv(path_to_mobility_stations_csv, delimiter=DELIMITER_SEMICOLON, encoding=ENCODING_UTF8)[
            [MOBILITY_STATIONSNUMMER, MOBILITY_STATIONSNAME, MOBILITY_STATIONSSTANDORT]].dropna()
    df_mobility_stations = df_mobility_vechicles.groupby(MOBILITY_STATIONSNUMMER).first().reset_index()
    df_mobility_stations[LONGITUDE] = df_mobility_stations[MOBILITY_STATIONSSTANDORT].apply(lambda x: x.split(",")[1])
    df_mobility_stations[LATITUDE] = df_mobility_stations[MOBILITY_STATIONSSTANDORT].apply(lambda x: x.split(",")[0])
    gdf_mobility_stations = gpd.GeoDataFrame(df_mobility_stations, geometry=gpd.points_from_xy(df_mobility_stations.lon,
                                                                                               df_mobility_stations.lat),
                                             crs=CRS_EPSG_ID_WGS84)
    log_end(additional_message="# mobility stations: {}".format(len(gdf_mobility_stations)))
    return gdf_mobility_stations


def get_gdf_mobilty_stations_with_npvm_zone(gdf_mobilty_stations, gdf_npvm_zones):
    log_start("joining mobility stations with npvm zones", log)
    gdf_mobilty_stations_with_npvm_zone = gpd.sjoin(gdf_mobilty_stations, gdf_npvm_zones)[
        [MOBILITY_STATIONSNUMMER, NPVM_ID, MOBILITY_STATIONSNAME, GEOMETRY]]
    log_end(
        additional_message="# mobility stations with npvm zone: {}".format(len(gdf_mobilty_stations_with_npvm_zone)))
    return gdf_mobilty_stations_with_npvm_zone


def read_skim(path_to_skim_mtx):
    log_start("reading skim from {}".format(path_to_skim_mtx), log)
    res = ReadPTVMatrix(path_to_skim_mtx)
    log_end()
    return res


def get_gdf_point_with_npvm_zone_id(point_easting_northing, gdf_npvm_zones):
    point = Point(point_easting_northing[0], point_easting_northing[1])
    gdf_point = gpd.GeoDataFrame({GEOMETRY: [point]}, crs="{}:{}".format(EPSG, CRS_EPSG_ID_WGS84))
    gdf_point_with_zone = gpd.sjoin(gdf_point, gdf_npvm_zones)[[NPVM_ID, NPVM_N_GEM, GEOMETRY]]
    return gdf_point_with_zone


def get_npvm_zone_id(gdf_point_with_npvm_zone_id):
    if len(gdf_point_with_npvm_zone_id) != 1:
        raise ValueError("only one entry exprected, but there are {}".format(len(gdf_point_with_npvm_zone_id)))
    return gdf_point_with_npvm_zone_id[NPVM_ID].item()


def get_skim(from_npvm_zone_id, to_npvm_zone_id, skim_matrix):
    return skim_matrix.sel(origins=from_npvm_zone_id).sel(destinations=to_npvm_zone_id).matrix.item()


def get_potential_mobility_stations(gdf_orig_with_npvm_zone_id, gdf_dest_with_npvm_zone_id,
                                    gdf_mobilty_stations_with_npvm_zone, skim_jrta, factor=1.5, constant=30.0):
    log_start("calculating potential mobility stations", log)
    orig_zone_id = get_npvm_zone_id(gdf_orig_with_npvm_zone_id)
    dest_zone_id = get_npvm_zone_id(gdf_dest_with_npvm_zone_id)
    jrta_orig_dest = get_skim(orig_zone_id, dest_zone_id, skim_jrta)
    potential_stations_ids = []
    for station_id, zone_id in gdf_mobilty_stations_with_npvm_zone[[MOBILITY_STATIONSNUMMER, NPVM_ID]].values.tolist():
        jrta_orig_station = get_skim(orig_zone_id, zone_id, skim_jrta)
        jrta_station_dest = get_skim(zone_id, dest_zone_id, skim_jrta)
        if jrta_orig_station + jrta_station_dest <= factor * jrta_orig_dest + constant:
            potential_stations_ids += [station_id]
    df_potential_station_ids = pd.DataFrame(potential_stations_ids, columns=[MOBILITY_STATIONSNUMMER])
    gdf_potential_mobility_stations = pd.merge(gdf_mobilty_stations_with_npvm_zone, df_potential_station_ids,
                                               on=[MOBILITY_STATIONSNUMMER])
    log_end(additional_message="# potential mobility stations: {}".format(len(gdf_potential_mobility_stations)))
    return gdf_potential_mobility_stations


def collect_data_on_potential_npvm_zones(gdf_orig_with_npvm_zone_id, gdf_dest_with_npvm_zone_id,
                                         gdf_potential_mobility_stations, skim_jrta, skim_ntr):
    log_start("collecting data on potential npvm zones", log)
    list_potential_mobility_stations = list(gdf_potential_mobility_stations.to_dict("records"))

    # get road distances and durations from potential mobility stations to destination from osrm
    coords_str = "{},{}".format(gdf_dest_with_npvm_zone_id[GEOMETRY].x.item(),
                                gdf_dest_with_npvm_zone_id[GEOMETRY].y.item())
    for pot_mob_st in list_potential_mobility_stations:
        center = pot_mob_st[GEOMETRY].centroid
        coords_str += ";{},{}".format(center.x, center.y)
    url = "https://router.project-osrm.org/table/v1/driving/{}?destinations=0&annotations=duration,distance".format(
        coords_str)
    res = requests.get(url).json()
    road_distances_from_potential_mobility_station_to_dest_per_stationsnummer = {
        x[MOBILITY_STATIONSNUMMER]: res[DISTANCES][n + 1][0] for n, x in enumerate(list_potential_mobility_stations)}
    road_durations_from_potential_mobility_station_to_dest_per_stationsnummer = {
        x[MOBILITY_STATIONSNUMMER]: res[DURATIONS][n + 1][0] for n, x in enumerate(list_potential_mobility_stations)}

    # get pt distances and durations from potential mobility stations to destination from jrta skim
    pd_distances = pd.DataFrame(list(road_distances_from_potential_mobility_station_to_dest_per_stationsnummer.items()),
                                columns=[MOBILITY_STATIONSNUMMER, MIV_DISTANZ_BIS_ZIEL_KM])
    pd_distances[MIV_DISTANZ_BIS_ZIEL_KM] = pd_distances[MIV_DISTANZ_BIS_ZIEL_KM] / 1000.0

    pd_durations = pd.DataFrame(list(road_durations_from_potential_mobility_station_to_dest_per_stationsnummer.items()),
                                columns=[MOBILITY_STATIONSNUMMER, MIV_ZEIT_BIS_ZIEL_MIN])
    pd_durations[MIV_ZEIT_BIS_ZIEL_MIN] = pd_durations[MIV_ZEIT_BIS_ZIEL_MIN] / 60.0

    # merge data with potential mobility stations
    gdf_potential_mobility_stations_with_data = pd.merge(gdf_potential_mobility_stations, pd_distances,
                                                         on=[MOBILITY_STATIONSNUMMER])
    gdf_potential_mobility_stations_with_data = pd.merge(gdf_potential_mobility_stations_with_data, pd_durations,
                                                         on=[MOBILITY_STATIONSNUMMER])
    zone_ids_list = set(x.item() for x in gdf_potential_mobility_stations[[NPVM_ID]].values)
    orig_zone_id = get_npvm_zone_id(gdf_orig_with_npvm_zone_id)
    jrta_list = [(x, get_skim(orig_zone_id, x, skim_jrta)) for x in zone_ids_list]
    ntr_list = [(x, get_skim(orig_zone_id, x, skim_ntr)) for x in zone_ids_list]

    pd_jrtas = pd.DataFrame(jrta_list, columns=[NPVM_ID, OEV_JRTA_VON_START_MIN])
    pd_ntrs = pd.DataFrame(ntr_list, columns=[NPVM_ID, OEV_NTR_VON_START])

    gdf_potential_mobility_stations_with_data = pd.merge(gdf_potential_mobility_stations_with_data, pd_jrtas,
                                                         on=[NPVM_ID])
    gdf_potential_mobility_stations_with_data = pd.merge(gdf_potential_mobility_stations_with_data, pd_ntrs,
                                                         on=[NPVM_ID])
    if len(gdf_potential_mobility_stations) != len(gdf_potential_mobility_stations_with_data):
        raise ValueError("# mobility stations has changed")
    log_end()
    return gdf_potential_mobility_stations_with_data


def calc_generalized_costs(gdf_potential_mobility_stations_with_data, vtt_chf_per_h=20):
    gdf_potential_mobility_stations_with_data[KOSTEN_CHF] = \
        CHF_PER_KM_MOBILITY * gdf_potential_mobility_stations_with_data[MIV_DISTANZ_BIS_ZIEL_KM] + \
        (gdf_potential_mobility_stations_with_data[MIV_ZEIT_BIS_ZIEL_MIN] + gdf_potential_mobility_stations_with_data[
            OEV_JRTA_VON_START_MIN] +
         gdf_potential_mobility_stations_with_data[OEV_NTR_VON_START] * MIN_PER_TRANSFER) / 60.0 * vtt_chf_per_h
    return gdf_potential_mobility_stations_with_data.sort_values(by=KOSTEN_CHF, ascending=True)


def calc_best_mobility_stations_per_vtt(gdf_potential_mobility_stations_with_data, vtt_chf_per_h,
                                        output_type=OUTPUT_TYPE_GDF):
    df_tmp = calc_generalized_costs(gdf_potential_mobility_stations_with_data, vtt_chf_per_h=vtt_chf_per_h)
    min_cost = df_tmp[KOSTEN_CHF].min()
    df_tmp = df_tmp[df_tmp[KOSTEN_CHF] <= min_cost * FILTER_FACTOR]
    df_tmp = pd.merge(gdf_potential_mobility_stations_with_data, df_tmp[[NPVM_ID]], on=NPVM_ID).sort_values(
        by=KOSTEN_CHF)
    if output_type == OUTPUT_TYPE_GDF:
        return df_tmp
    elif output_type == OUTPUT_TYPE_DICT:
        return df_tmp.to_dict("records")


def get_best_mobility_stations_per_vtt(orig_easting_northing, dest_easting_northing, gdf_npvm_zones,
                                       gdf_mobilty_stations_with_npvm_zone,
                                       skim_jrta, skim_ntr, output_type=OUTPUT_TYPE_GDF):
    log_start("searching best mobility stations from {} to {}".format(orig_easting_northing, dest_easting_northing),
              log)
    gdf_orig_with_npvm_zone_id = get_gdf_point_with_npvm_zone_id(orig_easting_northing, gdf_npvm_zones)
    gdf_dest_with_npvm_zone_id = get_gdf_point_with_npvm_zone_id(dest_easting_northing, gdf_npvm_zones)
    gdf_potential_mobility_stations = get_potential_mobility_stations(gdf_orig_with_npvm_zone_id,
                                                                      gdf_dest_with_npvm_zone_id,
                                                                      gdf_mobilty_stations_with_npvm_zone, skim_jrta)
    gdf_potential_mobility_stations_with_data = collect_data_on_potential_npvm_zones(gdf_orig_with_npvm_zone_id,
                                                                                     gdf_dest_with_npvm_zone_id,
                                                                                     gdf_potential_mobility_stations,
                                                                                     skim_jrta, skim_ntr)
    gdf_potential_mobility_stations_with_data[EASTING] = gdf_potential_mobility_stations_with_data[GEOMETRY].x
    gdf_potential_mobility_stations_with_data[NORTHING] = gdf_potential_mobility_stations_with_data[GEOMETRY].y
    gdf_potential_mobility_stations_with_data = gdf_potential_mobility_stations_with_data.drop([GEOMETRY], axis=1)
    best_mobility_stations_per_vtt = {
        vtt: calc_best_mobility_stations_per_vtt(gdf_potential_mobility_stations_with_data, vtt,
                                                 output_type=output_type) for vtt in range(0, 101)}

    gdf_potential_mobility_stations_with_data = gdf_potential_mobility_stations_with_data.drop([KOSTEN_CHF], axis=1)
    log_end()
    return best_mobility_stations_per_vtt, gdf_potential_mobility_stations_with_data