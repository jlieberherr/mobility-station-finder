import os
import geopandas as gpd

path_npvm_zones = os.path.join("..", "data", "Verkehrszonen_Schweiz_NPVM_2017_shp.zip")

gdf_npvm_zones = gpd.read_file(path_npvm_zones, encoding="cp1252").to_crs(4326)