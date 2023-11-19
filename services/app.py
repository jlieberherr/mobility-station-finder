#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import logging
import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime

import xarray as xr
import yaml
from flask import abort

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, MOBILITY_STATIONS_FILE_NAME, PT_JT_FILE_NAME, \
    PT_NT_FILE_NAME, OUTPUT_FOLDER, LOG_NAME, ROAD_DIST_FILE_NAME, ROAD_JT_FILE_NAME, PT_DIST_FILE_NAME
from params.project_params import OJP_XML_STR, URL_OJP
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

path_config = os.path.join(RESOURCES, "config.yaml")


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


namespaces = {
    'ojp': 'http://www.vdv.de/ojp',
    'xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'siri': 'http://www.siri.org.uk/siri'
}


def set_easting_northing(tree, tag, easting, northing):
    node = tree.find(tag, namespaces)
    node_easting = node.find('.//siri:Longitude', namespaces)
    node_easting.text = str(easting)
    node_northing = node.find('.//siri:Latitude', namespaces)
    node_northing.text = str(northing)


with open(path_config, 'r') as f:
    api_key = yaml.safe_load(f)['ojp_api_key']

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/xml'
}


def execute_ojp_request(orig_easting, orig_northing, dest_easting, dest_northing, dep_time):
    log_start(f"executing ojp request", log)
    tree = ET.fromstring(OJP_XML_STR)

    set_easting_northing(tree, './/ojp:Origin', orig_easting, orig_northing)
    set_easting_northing(tree, './/ojp:Destination', dest_easting, dest_northing)

    current_time = datetime.utcnow()
    req_time = current_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    node_request_time = tree.find('.//siri:RequestTimestamp', namespaces)
    node_request_time.text = req_time

    node_dep_time = tree.find('.//ojp:DepArrTime', namespaces)
    node_dep_time.text = dep_time

    new_xml_str = ET.tostring(tree)

    res = requests.post(URL_OJP, data=new_xml_str, headers=headers)

    log_end()
    if res.status_code != 200:
        log.error(f"OJP request failed with status code {res.status_code}")
        abort(res.status_code)
    else:
        return json.dumps({'xml_str': res.text})
