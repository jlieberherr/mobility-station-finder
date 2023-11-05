#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import logging
import os

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, MOBILITY_STATIONS_FILE_NAME, PT_JRTA_FILE_NAME, \
    PT_NTR_FILE_NAME, OUTPUT_FOLDER, LOG_NAME, ROAD_DIST_FILE_NAME, ROAD_JT_FILE_NAME, PT_DIST_FILE_NAME
from scripts.constants import OUTPUT_TYPE_DICT
from scripts.functions import get_gdf_npvm_zones, get_gdf_mobility_stations, get_gdf_mobility_stations_with_npvm_zone, \
    read_skim, get_best_mobility_stations_per_vtt
from scripts.helpers.my_logging import log_start, log_end, init_logging

log = logging.getLogger(__name__)

init_logging(OUTPUT_FOLDER, LOG_NAME)

path_npvm_zones = os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME)
path_mobility_stations = os.path.join(RESOURCES, MOBILITY_STATIONS_FILE_NAME)
path_pt_jrta = os.path.join(RESOURCES, PT_JRTA_FILE_NAME)
path_pt_ntr = os.path.join(RESOURCES, PT_NTR_FILE_NAME)
path_pt_dist = os.path.join(RESOURCES, PT_DIST_FILE_NAME)
path_road_dist = os.path.join(RESOURCES, ROAD_DIST_FILE_NAME)
path_road_jt = os.path.join(RESOURCES, ROAD_JT_FILE_NAME)


class DataContainer:
    gdf_npvm_zones = None
    gdf_mobility_stations = None
    gdf_mobility_stations_with_npvm_zone = None
    skim_jrta = None
    skim_ntr = None
    skimp_pt_dist = None
    skim_road_dist_npvm = None
    skim_road_jt_npvm = None


def load_data(load_road_skims_npvm=False):
    log_start("loading static data", log)
    DataContainer.gdf_npvm_zones = get_gdf_npvm_zones(path_npvm_zones)
    DataContainer.gdf_mobility_stations = get_gdf_mobility_stations(path_mobility_stations)
    DataContainer.gdf_mobility_stations_with_npvm_zone = get_gdf_mobility_stations_with_npvm_zone(
        DataContainer.gdf_mobility_stations, DataContainer.gdf_npvm_zones)
    DataContainer.skim_jrta = read_skim(path_pt_jrta)
    DataContainer.skim_ntr = read_skim(path_pt_ntr)
    DataContainer.skimp_pt_dist = read_skim(path_pt_dist)
    if load_road_skims_npvm:
        DataContainer.skim_road_dist_npvm = read_skim(path_road_dist)
        DataContainer.skim_road_jt_npvm = read_skim(path_road_jt)
    log_end()


def execute_query(orig_easting, orig_northing, dest_easting, dest_northing, osrm_routing=True):
    best_mobility_stations_per_vtt, _ = \
        get_best_mobility_stations_per_vtt((orig_easting, orig_northing),
                                           (dest_easting, dest_northing),
                                           DataContainer.gdf_npvm_zones,
                                           DataContainer.gdf_mobility_stations_with_npvm_zone,
                                           DataContainer.skim_jrta,
                                           DataContainer.skim_ntr,
                                           osrm_routing,
                                           DataContainer.skim_road_dist_npvm,
                                           DataContainer.skim_road_jt_npvm,
                                           output_type=OUTPUT_TYPE_DICT)
    return json.dumps(best_mobility_stations_per_vtt)
