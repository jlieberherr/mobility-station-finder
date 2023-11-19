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

URL_OJP = 'https://api.opentransportdata.swiss/ojp2020'

OJP_XML_STR = '''<?xml version="1.0" encoding="utf-8"?>
<OJP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.siri.org.uk/siri" version="1.0" xmlns:ojp="http://www.vdv.de/ojp" xsi:schemaLocation="http://www.siri.org.uk/siri ../ojp-xsd-v1.0/OJP.xsd">
    <OJPRequest>
        <ServiceRequest>
            <RequestTimestamp>2023-12-04T09:10:32.267Z</RequestTimestamp>
            <RequestorRef>API-Explorer</RequestorRef>
            <ojp:OJPTripRequest>
                <RequestTimestamp>2023-12-04T09:10:32.267Z</RequestTimestamp>
                <ojp:Origin>
                    <ojp:PlaceRef>
                        <ojp:GeoPosition>
                            <Longitude>7.446683</Longitude>
                            <Latitude>46.928306</Latitude>
                        </ojp:GeoPosition>
                        <ojp:LocationName>
                            <ojp:Text>Start</ojp:Text>
                        </ojp:LocationName>
                    </ojp:PlaceRef>
                    <ojp:DepArrTime>2023-12-04T10:00:00</ojp:DepArrTime>
                </ojp:Origin>
                <ojp:Destination>
                    <ojp:PlaceRef>
                        <ojp:GeoPosition>
                            <Longitude>8.55408</Longitude>
                            <Latitude>47.36488</Latitude>
                        </ojp:GeoPosition>
                        <ojp:LocationName>
                            <ojp:Text>Ziel</ojp:Text>
                        </ojp:LocationName>
                    </ojp:PlaceRef>
                </ojp:Destination>
                <ojp:Params>
                    <ojp:IncludeTrackSections>true</ojp:IncludeTrackSections>
                    <ojp:IncludeLegProjection>true</ojp:IncludeLegProjection>
                    <ojp:IncludeTurnDescription></ojp:IncludeTurnDescription>
                    <ojp:IncludeIntermediateStops></ojp:IncludeIntermediateStops>
                </ojp:Params>
            </ojp:OJPTripRequest>
        </ServiceRequest>
    </OJPRequest>
</OJP>'''
