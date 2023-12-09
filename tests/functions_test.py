#!/usr/bin/python
# -*- coding: utf-8 -*-
import os

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, MOBILITY_STATIONS_FILE_NAME
from scripts.functions import get_gdf_point_with_zone_id, get_zone_id, \
    get_gdf_mobility_stations_from_file, get_gdf_npvm_zones, \
    get_gdf_mobility_stations_with_npvm_zone

gdf_npvm_zones = get_gdf_npvm_zones(os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME))

gdf_mobility_stations = get_gdf_mobility_stations_from_file(os.path.join(RESOURCES, MOBILITY_STATIONS_FILE_NAME))
gdf_mobility_stations_with_npvm_zone = get_gdf_mobility_stations_with_npvm_zone(gdf_mobility_stations, gdf_npvm_zones)


def test_get_gdf_npvm_zones():
    assert len(gdf_npvm_zones) == 7978


def test_get_gdf_mobility_stations():
    assert len(gdf_mobility_stations) == 1550


def test_get_gdf_mobility_stations_with_npvm_zone():
    assert len(gdf_mobility_stations_with_npvm_zone) == 1549


def test_get_gdf_point_with_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert len(gdf_point_with_npvm_id) == 1
    assert gdf_point_with_npvm_id.to_dict(orient="records")[0]["N_Gem"] == "Bern"


def test_get_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert get_zone_id(gdf_point_with_npvm_id) == 35101026
