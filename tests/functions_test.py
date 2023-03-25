#!/usr/bin/python
# -*- coding: utf-8 -*-
import os

import geopandas as gpd
import pytest
from matrixconverters.read_ptv import ReadPTVMatrix

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, ENCODING_CP1252, CRS_ID, PATH_PT_JRTA, \
    PATH_PT_NTR
from scripts.functions import get_gdf_point_with_npvm_zone_id, get_npvm_zone_id, get_skim

gdf_npvm_zones = gpd.read_file(os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME), encoding=ENCODING_CP1252).to_crs(
    CRS_ID)

skim_jrta = ReadPTVMatrix(os.path.join(RESOURCES, PATH_PT_JRTA))
skim_ntr = ReadPTVMatrix(os.path.join(RESOURCES, PATH_PT_NTR))


def test_get_gdf_point_with_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_npvm_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert len(gdf_point_with_npvm_id) == 1
    assert gdf_point_with_npvm_id.to_dict(orient="records")[0]["N_Gem"] == "Bern"


def test_get_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_npvm_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert get_npvm_zone_id(gdf_point_with_npvm_id) == 35101026


def test_get_skim():
    # Bern, Dübystrasse -> Bern Bahnhof
    assert get_skim(35101026, 35101052, skim_jrta) == pytest.approx(15.0, 5.0)
    assert get_skim(35101026, 35101052, skim_ntr) == pytest.approx(0.0, 0.01)

    # Bern, Bahnhof -> Chur, Bahnhof
    assert get_skim(35101052, 390101012, skim_jrta) == pytest.approx(2.5 * 60, 20)
    assert get_skim(35101052, 390101012, skim_ntr) == pytest.approx(1, 0.1)
