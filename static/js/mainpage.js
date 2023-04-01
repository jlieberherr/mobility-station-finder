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

// Used to load and display tile layers on the map
// Most tile servers require attribution, which you can set under `Layer`
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const length = document.querySelector(".info");
const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const searchButton = document.querySelector(".run-search");

let markers = [];
let featureGroups = [];

function results({currentValue, matches, template}) {
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

function addMarkerToMap(object) {
    const {display_name} = object.properties;
    const arr = object.geometry.coordinates.reverse();

    const customId = Math.random();

    const marker = L.marker(arr, {
        title: display_name,
        id: customId,
        draggable: true
    });

    // add marker to map
    marker.addTo(map).bindPopup(display_name);

    map.setView(arr, 8);

    // add marker to array markers
    markers.push(arr);

    // add marker to array featureGroup
    featureGroups.push(marker);

    if (markers.length == 2) {
        // add polyline between cities
        L.polyline(markers, {
            color: "red",
        }).addTo(map);

        // matching all markers to the map view
        let group = new L.featureGroup(featureGroups);
        map.fitBounds(group.getBounds(), {
            padding: [10, 10], // adding padding to map
        });

        // add text 'Length (in kilometers):'
        distanceBetweenMarkers();
    }

    if (markers.length > 2) {
        clearData();
    }
}

function clearData() {
    // clear array
    markers = [];

    // back to default coordinate
    map.panTo([lat, lng]);

    // set info ;)
    length.textContent = "Markers and plines have been removed";

    // remove polyline
    for (i in map._layers) {
        if (map._layers[i]._path != undefined) {
            try {
                map.removeLayer(map._layers[i]);
            } catch (e) {
                console.log("problem with " + e + map._layers[i]);
            }
        }
    }

    // remove markers
    map.eachLayer((layer) => {
        if (layer.options && layer.options.pane === "markerPane") {
            map.removeLayer(layer);
        }
    });
}

function distanceBetweenMarkers() {
    const from = L.marker(markers[0]).getLatLng();
    const to = L.marker(markers[1]).getLatLng();

    // in km
    const distance = from.distanceTo(to) / 1000;

    length.textContent = `From: ${from} to: ${to}`;
}

window.addEventListener("DOMContentLoaded", function () {
    ["orig", "dest"].forEach((point) => {
        const auto = new Autocomplete(point, {
            searchButton: false,
            howManyCharacters: 2,

            onSearch: ({currentValue}) => nominatim(currentValue),

            onResults: (object) => results(object),

            onSubmit: ({object}) => addMarkerToMap(object),

            // the method presents no results
            noResults: ({currentValue, template}) =>
                template(`<li>No results found: "${currentValue}"</li>`),
        });

        searchButton.addEventListener("click", () => {
            clearData();

            // destroy method
            auto.destroy();

            // focus on first input
            document.querySelector("#orig").focus();
        });
    });
});