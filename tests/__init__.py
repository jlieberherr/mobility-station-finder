#!/usr/bin/python
# -*- coding: utf-8 -*-

from params.project_params import TESTS_OUTPUT_FOLDER, TESTS_LOG_NAME
from scripts.helpers.my_logging import init_logging

init_logging(TESTS_OUTPUT_FOLDER, TESTS_LOG_NAME)
