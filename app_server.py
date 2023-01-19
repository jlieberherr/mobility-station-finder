from flask import Flask, render_template
import connexion

from msf_flask_app.model import load_data

load_data()

app = connexion.App(__name__)
app.add_api("swagger.yml")

@app.route("/")
def home():
	return render_template("map.html")


if __name__ == "__main__":
    app.run()