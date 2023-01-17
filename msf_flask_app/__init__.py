
from flask import Flask, render_template
import connexion

from model import load_data, DataContainer

app = connexion.App(__name__, specification_dir="./")
app.add_api("swagger.yml")

@app.route("/")
def home():
	return render_template("map.html")

if __name__ == "__main__":
    load_data()
    app.run()