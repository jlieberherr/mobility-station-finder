#!/usr/bin/python
# -*- coding: utf-8 -*-
"""This module defines the functions used in the app."""
import geopandas as gpd
from shapely.geometry import Point


def get_gdf_point_with_npvm_zone_id(point_easting_northing, gdf_npvm_zones):
    point = Point(point_easting_northing[0], point_easting_northing[1])
    gdf_point = gpd.GeoDataFrame({'geometry': [point]}, crs="EPSG:4326")
    gdf_point_with_zone = gpd.sjoin(gdf_point, gdf_npvm_zones)[["ID", "N_Gem", "geometry"]]
    return gdf_point_with_zone
