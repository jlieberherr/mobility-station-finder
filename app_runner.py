from flask import Flask, render_template
import connexion

from services.app import load_data

load_data()

app = connexion.App(__name__)
app.add_api("swagger.yml")


@app.route("/")
def home():
    return render_template("mainpage.html")


if __name__ == "__main__":
    app.run()
