#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import logging
import os

import xarray as xr

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, MOBILITY_STATIONS_FILE_NAME, PT_JT_FILE_NAME, \
    PT_NT_FILE_NAME, OUTPUT_FOLDER, LOG_NAME, ROAD_DIST_FILE_NAME, ROAD_JT_FILE_NAME, PT_DIST_FILE_NAME
from scripts.functions import get_gdf_npvm_zones, get_gdf_mobility_stations, get_gdf_mobility_stations_with_npvm_zone, \
    run_query
from scripts.helpers.my_logging import log_start, log_end, init_logging

log = logging.getLogger(__name__)

init_logging(OUTPUT_FOLDER, LOG_NAME)

path_npvm_zones = os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME)
path_mobility_stations = os.path.join(RESOURCES, MOBILITY_STATIONS_FILE_NAME)
path_pt_jrta = os.path.join(RESOURCES, PT_JT_FILE_NAME)
path_pt_ntr = os.path.join(RESOURCES, PT_NT_FILE_NAME)
path_pt_dist = os.path.join(RESOURCES, PT_DIST_FILE_NAME)
path_road_dist = os.path.join(RESOURCES, ROAD_DIST_FILE_NAME)
path_road_jt = os.path.join(RESOURCES, ROAD_JT_FILE_NAME)


class DataContainer:
    gdf_zones = None
    gdf_mobility_stations = None
    gdf_mobility_stations_with_zone = None
    pt_jt = None
    pt_nt = None
    pt_dist = None
    road_jt = None
    road_dist = None


def load_data():
    log_start("loading static data", log)
    DataContainer.gdf_zones = get_gdf_npvm_zones(path_npvm_zones)
    DataContainer.gdf_mobility_stations = get_gdf_mobility_stations(path_mobility_stations)
    DataContainer.gdf_mobility_stations_with_zone = get_gdf_mobility_stations_with_npvm_zone(
        DataContainer.gdf_mobility_stations, DataContainer.gdf_zones)
    DataContainer.pt_jt = xr.open_dataset(path_pt_jrta)
    DataContainer.pt_nt = xr.open_dataset(path_pt_ntr)
    DataContainer.pt_dist = xr.open_dataset(path_pt_dist)
    DataContainer.road_jt = xr.open_dataset(path_road_jt)
    DataContainer.road_dist = xr.open_dataset(path_road_dist)
    log_end()


def execute_query(orig_easting, orig_northing, dest_easting, dest_northing):
    res = run_query((orig_easting, orig_northing), (dest_easting, dest_northing),
                    DataContainer.gdf_zones,
                    DataContainer.gdf_mobility_stations_with_zone,
                    DataContainer.pt_jt,
                    DataContainer.pt_nt,
                    DataContainer.pt_dist,
                    DataContainer.road_jt,
                    DataContainer.road_dist
                    )
    return json.dumps(res)
