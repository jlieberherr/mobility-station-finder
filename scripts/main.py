#!/usr/bin/python
# -*- coding: utf-8 -*-
from services.app import load_data, execute_query

if __name__ == '__main__':
    load_data()
    execute_query(7.4234812, 46.9366421, 7.5831644, 46.9416664)
