#!/usr/bin/python
# -*- coding: utf-8 -*-
"""Some project parameters."""
import os
from os.path import join

RESOURCES = "data"
RESOURCES_FOLDER = join(os.getcwd(), RESOURCES)  # path of the folder with resources data.

NPVM_ZONES_SHP_FILE_NAME = "Verkehrszonen_Schweiz_NPVM_2017_shp.zip"
PATH_PT_JRTA = "140_JRTA_(OEV).mtx"
PATH_PT_NTR = "144_NTR_(OEV).mtx"

LOG_NAME = "log.log"  # name of the log file.

CRS_ID = 4326
ENCODING_CP1252 = "cp1252"

# tests
TESTS = "tests"  # name of folder with the tests.
TESTS_FOLDER = join(os.getcwd(), TESTS)  # path of the folder with the tests.
TESTS_OUTPUT = "output"  # name of folder with temporary output from tests.
TESTS_OUTPUT_FOLDER = join(TESTS_FOLDER, TESTS_OUTPUT)  # path of the folder with temporary output from tests.
TESTS_RESOURCES = "resources"
TESTS_RESOURCES_FOLDER = join(os.getcwd(), TESTS_RESOURCES)  # path of the folder with resources data for tests.
TESTS_LOG_NAME = "test_log.log"  # name of the log file used for tests.
