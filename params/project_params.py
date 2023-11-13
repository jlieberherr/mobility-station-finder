#!/usr/bin/python
# -*- coding: utf-8 -*-
"""Some project parameters."""
import os
from os.path import join

RESOURCES = "data"
RESOURCES_FOLDER = join(os.getcwd(), RESOURCES)  # path of the folder with resources data.

MOBILITY_STATIONS_FILE_NAME = "mobility-stationen-und-fahrzeuge-schweiz.csv"
NPVM_ZONES_SHP_FILE_NAME = "Verkehrszonen_Schweiz_NPVM_2017_shp.zip"
PT_JT_FILE_NAME = "pt_jt.nc"
PT_NT_FILE_NAME = "pt_nt.nc"
PT_DIST_FILE_NAME = "pt_dist.nc"
ROAD_JT_FILE_NAME = "road_jt.nc"
ROAD_DIST_FILE_NAME = "road_dist.nc"

PT_JT = 'pt_jt'
PT_NT = 'pt_nt'
PT_DIST = 'pt_dist'
ROAD_JT = 'road_jt'
ROAD_DIST = 'road_dist'

MATRIX = 'matrix'

OUTPUT = "output"
OUTPUT_FOLDER = join(os.getcwd(), OUTPUT)
LOG_NAME = "log.log"  # name of the log file.

CRS_EPSG_ID_WGS84 = 4326
ENCODING_CP1252 = "cp1252"
ENCODING_UTF8 = "utf-8"

DELIMITER_SEMICOLON = ";"

# tests
TESTS = "tests"  # name of folder with the tests.
TESTS_FOLDER = join(os.getcwd(), TESTS)  # path of the folder with the tests.
TESTS_OUTPUT = "output"  # name of folder with temporary output from tests.
TESTS_OUTPUT_FOLDER = join(TESTS_FOLDER, TESTS_OUTPUT)  # path of the folder with temporary output from tests.
TESTS_RESOURCES = "resources"
TESTS_RESOURCES_FOLDER = join(os.getcwd(), TESTS_RESOURCES)  # path of the folder with resources data for tests.
TESTS_LOG_NAME = "test_log.log"  # name of the log file used for tests.
