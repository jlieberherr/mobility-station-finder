# mobility-station-finder

This is the repository for the Mobility-Station-Finder project. See <a href="https://mobility-station-finder.ch">mobility-station-finder.ch</a> for the live version 
and <a href="https://jlieberherr.github.io/mobility-station-finder/">the project page</a> for more information.

# Installation
## Locally (Windows)
1. Downlad Python 3.10.8
2. Create a virtual environment: ```path/to/python/3.10.8/installation/python.exe -m venv env_msf```
3. Activate the virtual environment: ```Scripts\activate```
4. Navigate to development folder and clone the repository: ```git clone https://github.com/jlieberherr/mobility-station-finder.git```
5. ```cd mobility-station-finder``` and```pip install -r requirements_local.txt```
6. Prepare the data as described in ```data\readme_data.txt```
7. Run the tests: ```pytest tests```
8. Run the Flask server by ```python app_runner.py``` on http://127.0.0.1:5000

## Server (Linux)
1. Install Python 3.10.8, the virtual environment and the data as in step 1 to 6 above
2. Install nginx and gunicorn, see i.e. [here](https://www.linode.com/docs/guides/flask-and-gunicorn-on-ubuntu/#prepare-the-production-environment)
3. Configure nginx, see i.e. [here](https://www.linode.com/docs/guides/flask-and-gunicorn-on-ubuntu/#configure-nginx)
4. Run the Flask server by ```gunicorn -w 1 app_runner:app app_runner.py```

