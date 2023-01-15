# mobility-station-finder

# Installation

## Locally (Windows, pip is standard)
### With pip
1. Downlad Python 3.10.8
2. Navigate to folder with virtual environments, then ```path/to/python/3.10.8/installation/python.exe -m venv env_msf```
3. ```Scripts\activate```
4. Navigate to ```mobility-station-finder```-folder, then ```pip install -r requirements_local.txt```
For activation run only step 3

### With conda (```env_msf.yml``` may not be actual)
1. Install [Anaconda 3](https://www.anaconda.com/products/individual#) on your computer (or at least Miniconda 3)
2. Start the conda prompt and navigate to this git-repository on your computer
3. Create the conda environment: ```conda env create -f env_msf.yml```
4. Activate the environment: ```conda activate env_msf```


## Server (Linux, works only with pip)
1. Downlad Python 3.10.8
2. ```sudo apt install virtualenv```
3. Navigate to folder with virtual environments, then ```virtualenv --python="/path/to/python3.10.8" env_msf```
4. ```source env_msf/bin/activate```
5. Navigate to ```mobility-station-finder```-folder, then ```pip install -r requirements_server.txt```
For activation run only step 3


Hints:
- To start Juypter: ```jupyter lab```
- With conda: Install a new package with ```conda install <package-name>```, update the yml-environment-file with ```conda env export > env_msf.yml```, commit and push
