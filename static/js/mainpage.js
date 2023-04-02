/*
 * Mobility-Station-Finder
 */

// config map
let config = {
    minZoom: 2,
    maxZoom: 18,
};
// magnification with which the map will start
const zoom = 9;
// co-ordinates
const lat = 46.800663464;
const lng = 8.222665776;

// calling map
const map = L.map("map", config).setView([lat, lng], zoom);

var origIcon = new L.Icon({
    iconUrl: 'static/resources/marker-icon-red.png',
});

var destIcon = new L.Icon({
    iconUrl: 'static/resources/marker-icon-blue.png',
});

// Used to load and display tile layers on the map
// Most tile servers require attribution, which you can set under `Layer`
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const info = document.querySelector(".info");
const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const searchButton = document.querySelector(".run-search");
const slider = document.querySelector(".slider");

let bestMobilityStationsPerVTTS = {};
let origMarker = null;
let destMarker = null;
let stationMarkers = [];

function results({ currentValue, matches, template }) {
    const regex = new RegExp(currentValue, "i");
    // checking if we have results if we don't
    // take data from the noResults method
    return matches === 0
        ? template
        : matches
            .map((element) => {
                return `
          <li class="autocomplete-item" role="option" aria-selected="false">
            <p>${element.properties.display_name.replace(
                    regex,
                    (str) => `<b>${str}</b>`
                )}</p>
          </li> `;
            })
            .join("");
}

function nominatim(currentValue) {
    const api = `https://nominatim.openstreetmap.org/search?format=geojson&limit=5&q=${encodeURI(
        currentValue
    )}`;

    return new Promise((resolve) => {
        fetch(api)
            .then((response) => response.json())
            .then((data) => {
                resolve(data.features);
            })
            .catch((error) => {
                console.error(error);
            });
    });
}

function clearStationsMarkers() {
    stationMarkers.forEach((marker) => {
        marker.remove();
    });
    stationMarkers = [];
}

function addMarkerToMap(point, object) {

    clearStationsMarkers();

    const display_name = object.properties.display_name;
    const coords = object.geometry.coordinates.reverse();

    if (point == "orig") {
        if (origMarker != null) {
            origMarker.remove();
        }
        title = `Startpunkt: ${display_name}`
        icon = origIcon;
    }
    else if (point == "dest") {
        if (destMarker != null) {
            destMarker.remove();
        }
        title = `Endpunkt: ${display_name}`;
        icon = destIcon;
    }

    const marker = L.marker(coords, {
        title: title,
        draggable: true,
        icon: icon,
    });

    if (point == "orig") {
        origMarker = marker;
    }
    else if (point == "dest") {
        destMarker = marker;
    }

    // add marker to map
    marker.addTo(map).bindPopup(title);

}


function getBestMobilityStations() {

    bestMobilityStationsPerVTTS = {}

    // get result form an rest interface
    const api = `http://127.0.0.1:5000/api/get-best-mobility-stations?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${destMarker._latlng.lng}&dest_northing=${destMarker._latlng.lat}`;


    // fetch data
    fetch(api)
        .then((response) => response.json())
        .then((data) => {
            console.log(data)
            bestMobilityStationsPerVTTS = JSON.parse(data);
            const vTTS = slider.value;
            showBestMobilityStations(vTTS);
        })
}

function showBestMobilityStations(vTTS) {
    stationMarkers.forEach((marker) => {
        marker.remove();
    });
    stationMarkers = [];

    bestMobilityStations = bestMobilityStationsPerVTTS[vTTS];
    bestMobilityStations.forEach((station) => {
        stationName = station["Name"]
        easting = station["easting"]
        northing = station["northing"]
        marker = L.circleMarker([northing, easting], { fillColor: "red" , color: "red"})
        stationMarkers.push(marker)
        marker.addTo(map).bindPopup(stationName);
    }
    )
}

// add event listener to slider
slider.addEventListener("input", () => {
    showBestMobilityStations(slider.value);
});


// add event listener to button 'search'
searchButton.addEventListener("click", () => {
    // get best mobility stations
    getBestMobilityStations();
});


window.addEventListener("DOMContentLoaded", function () {

    ["orig", "dest"].forEach((point) => {
        const auto = new Autocomplete(point, {
            searchButton: false,
            howManyCharacters: 2,

            onSearch: ({ currentValue }) => nominatim(currentValue),

            onResults: (object) => results(object),

            onSubmit: ({ object }) => addMarkerToMap(point, object),

            onReset: () => {
                if (point == "orig") {
                    origMarker.remove();
                }
                else if (point == "dest") {
                    destMarker.remove();
                }
            },
            // the method presents no results
            noResults: ({ currentValue, template }) =>
                template(`<li>No results found: "${currentValue}"</li>`),
        });

    });
});