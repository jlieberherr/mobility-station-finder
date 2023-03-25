#!/usr/bin/python
# -*- coding: utf-8 -*-
"""This module collects some helper functions."""
import logging
from datetime import date

log = logging.getLogger(__name__)


def parse_yymmdd(yymmdd_str):
    """Parses a YYYYMMDD-string and returns the corresponding date.

    Args:
        yymmdd_str (str): YYYYMMDD-string

    Returns:
        date: the corresponding date.
    """
    y = int(yymmdd_str[:4])
    m = int(yymmdd_str[4:6])
    d = int(yymmdd_str[6:8])
    return date(y, m, d)


def hhmmss_to_sec(hhmmss):
    """Parses a HH:MM:SS-string and returns the corresponding number of seconds after midnight.

    Args:
        hhmmss (str): HH:MM:SS-string

    Returns:
        int: number of seconds after midnight.
    """
    h, m, s = hhmmss.split(':')
    return int(h) * 3600 + int(m) * 60 + int(s)


def seconds_to_hhmmssms(seconds):
    """Parses the number of seconds after midnight and returns the corresponding HH:MM:SS.f-string.

    Args:
        seconds (float): number of seconds after midnight.

    Returns:
        str: the corresponding HH:MM:SS.f-string.
    """
    int_seconds = int(seconds)
    ms = round((seconds - int_seconds) * 1000)
    m, s = divmod(int_seconds, 60)
    h, m = divmod(m, 60)
    return "{:02d}:{:02d}:{:02d}.{:03d}".format(h, m, s, ms)


def seconds_to_hhmmss(seconds):
    """Parses the number of seconds after midnight and returns the corresponding HH:MM:SS-string.

    Args:
        seconds (float): number of seconds after midnight.

    Returns:
        str: the corresponding HH:MM:SS-string.
    """
    if seconds is None:
        return None
    int_seconds = int(seconds)
    m, s = divmod(int_seconds, 60)
    h, m = divmod(m, 60)
    return "{:02d}:{:02d}:{:02d}".format(h, m, s)
