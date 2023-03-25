#!/usr/bin/python
# -*- coding: utf-8 -*-
import os

import geopandas as gpd

from params.project_params import RESOURCES, NPVM_ZONES_SHP_FILE_NAME, ENCODING_CP1252, CRS_ID
from scripts.functions import get_gdf_point_with_npvm_zone_id

gdf_npvm_zones = gpd.read_file(os.path.join(RESOURCES, NPVM_ZONES_SHP_FILE_NAME), encoding=ENCODING_CP1252).to_crs(
    CRS_ID)


def test_get_gdf_point_with_npvm_zone_id():
    gdf_point_with_npvm_id = get_gdf_point_with_npvm_zone_id((7.423570, 46.936620), gdf_npvm_zones)
    assert len(gdf_point_with_npvm_id) == 1
    assert gdf_point_with_npvm_id.to_dict(orient="records")[0]["N_Gem"] == "Bern"
