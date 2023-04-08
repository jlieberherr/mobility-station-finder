#!/usr/bin/python
# -*- coding: utf-8 -*-
import os

import pytest

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, PT_JRTA_FILE_NAME, \
    PT_NTR_FILE_NAME, MOBILITY_STATIONS_FILE_NAME
from scripts.functions import get_gdf_point_with_npvm_zone_id, get_npvm_zone_id, get_skim, \
    get_gdf_mobility_stations, get_gdf_npvm_zones, \
    get_gdf_mobility_stations_with_npvm_zone, read_skim, get_best_mobility_stations_per_vtt

gdf_npvm_zones = get_gdf_npvm_zones(os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME))

gdf_mobility_stations = get_gdf_mobility_stations(os.path.join(RESOURCES, MOBILITY_STATIONS_FILE_NAME))
gdf_mobility_stations_with_npvm_zone = get_gdf_mobility_stations_with_npvm_zone(gdf_mobility_stations, gdf_npvm_zones)

skim_jrta = read_skim(os.path.join(RESOURCES, PT_JRTA_FILE_NAME))
skim_ntr = read_skim(os.path.join(RESOURCES, PT_NTR_FILE_NAME))


def test_get_gdf_npvm_zones():
    assert len(gdf_npvm_zones) == 7978


def test_get_gdf_mobility_stations():
    assert len(gdf_mobility_stations) == 1550


def test_get_gdf_mobility_stations_with_npvm_zone():
    assert len(gdf_mobility_stations_with_npvm_zone) == 1549


def test_get_gdf_point_with_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_npvm_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert len(gdf_point_with_npvm_id) == 1
    assert gdf_point_with_npvm_id.to_dict(orient="records")[0]["N_Gem"] == "Bern"


def test_get_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_npvm_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert get_npvm_zone_id(gdf_point_with_npvm_id) == 35101026


def test_get_skim():
    # Bern Dübystrasse -> Bern Bahnhof
    assert get_skim(35101026, 35101052, skim_jrta) == pytest.approx(15, abs=5)
    assert get_skim(35101026, 35101052, skim_ntr) == pytest.approx(0, abs=0.01)

    # Bern Bahnhof -> Zürich HB
    assert get_skim(35101052, 26101169, skim_jrta) == pytest.approx(60, abs=10)
    assert get_skim(35101052, 26101169, skim_ntr) == pytest.approx(0, abs=0.1)

    # Bern Bahnhof -> Chur Bahnhof
    assert get_skim(35101052, 390101018, skim_jrta) == pytest.approx(160, abs=15)
    assert get_skim(35101052, 390101018, skim_ntr) == pytest.approx(1, abs=0.1)


def test_get_best_mobility_stations_per_vtt():
    orig_easting_northing = (7.423570, 46.936620)  # Simplonweg 21, 3014 Bern
    dest_easting_northing = (7.343680184933122, 46.551891386747386)  # Sparenmoos
    best_mobility_stations_per_vtt = get_best_mobility_stations_per_vtt(orig_easting_northing,
                                                                        dest_easting_northing,
                                                                        gdf_npvm_zones,
                                                                        gdf_mobility_stations_with_npvm_zone,
                                                                        skim_jrta, skim_ntr)
    assert len(best_mobility_stations_per_vtt) > 0
