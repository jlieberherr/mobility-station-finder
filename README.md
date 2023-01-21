# mobility-station-finder

# Installation

## Locally (Windows)
1. Downlad Python 3.10.8
2. Navigate to folder with virtual environments, then ```path/to/python/3.10.8/installation/python.exe -m venv env_msf```
3. ```Scripts\activate```
3. Navigate to development folder, then ```git clone https://github.com/jlieberherr/mobility-station-finder.git```
4. Navigate to ```mobility-station-finder```-folder, then ```pip install -r requirements_local.txt```

For activation run only step 3.

Run the Flask server by ```python app_server.py``` on http://127.0.0.1:5000.

## Server (Linux)
1. For installation of nginx and gunicorn see [here](https://www.linode.com/docs/guides/flask-and-gunicorn-on-ubuntu/#prepare-the-production-environment)
2. Downlad Python 3.10.8
3. ```sudo apt install virtualenv```
4. Navigate to folder with virtual environments, then ```virtualenv --python="/path/to/python3.10.8" env_msf```
5. ```source path/to/env_msf/bin/activate```
6. Navigate to development folder, then ```git clone https://github.com/jlieberherr/mobility-station-finder.git```
7. Navigate to ```mobility-station-finder```-folder, then ```pip install -r requirements_server.txt```

For activation run only step 3.

Run the Flask server with gunicorn by ```gunicorn -w 1 app_server:app app_server.py``` on http://139.144.183.43.


Hints:
- To start Juypter: ```jupyter lab```
