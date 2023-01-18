import os
import pandas as pd
import geopandas as gpd

path_npvm_zones = os.path.join("data", "Verkehrszonen_Schweiz_NPVM_2017_shp.zip")
path_mobility_stations = os.path.join("data", "mobility-stationen-und-fahrzeuge-schweiz.csv")
path_pt_jrta = os.path.join("data", "140_JRTA_(OEV).mtx")
path_pt_ntr = os.path.join("data", "144_NTR_(OEV).mtx")

class DataContainer:
    gdf_npvm_zones = None
    gdf_npvm_zones_with_mobility_station = None

def load_data():
    print("Start loading data")
    print("Start loading NPVM zones")
    DataContainer.gdf_npvm_zones = gpd.read_file(path_npvm_zones, encoding="cp1252").to_crs(4326)
    print("End loading NPVM zones")

    df_mobility_vechicles = pd.read_csv(path_mobility_stations, delimiter=";", encoding="utf8")[["Stationsnummer", "Name", "Standort"]].dropna()
    df_mobility_stations = df_mobility_vechicles.groupby("Stationsnummer").first().reset_index()
    df_mobility_stations["lon"] = df_mobility_stations["Standort"].apply(lambda x: x.split(",")[1])
    df_mobility_stations["lat"] = df_mobility_stations["Standort"].apply(lambda x: x.split(",")[0])
    df_mobility_stations = gpd.GeoDataFrame(df_mobility_stations, geometry=gpd.points_from_xy(df_mobility_stations.lon, df_mobility_stations.lat), crs=4326)
    gdf_mobilty_stations_with_npvm_zone = gpd.sjoin(df_mobility_stations, DataContainer.gdf_npvm_zones)[["Stationsnummer", "Name", "geometry", "ID", "N_Gem"]]
    DataContainer.gdf_npvm_zones_with_mobility_station = gdf_mobilty_stations_with_npvm_zone.dissolve(by="ID", aggfunc={"N_Gem": "first","Name": lambda x: list(x), "Stationsnummer": lambda x: list(x)}).reset_index()
    print("End loading data")


def get_npvm_zone(coords):
    return "Output: {}".format(DataContainer.gdf_npvm_zones_with_mobility_station[DataContainer.gdf_npvm_zones_with_mobility_station.N_Gem == coords])