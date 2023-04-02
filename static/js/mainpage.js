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




// Add a contextmenu event listener to the map
map.on('contextmenu', function (e) {
    // Create the popup content
    const form = `
    <form>
      <label id="origField">Hier Startpunkt setzen</label>
      <br>
      <label id="destField">Hier Zielpunkt setzen</label>
    </form>
  `;

    // Open the popup when the map is right-clicked
    const popup = L.popup().setLatLng(e.latlng).setContent(form).openOn(map);
    const formElement = popup.getElement().querySelector('form');

    const origField = formElement.querySelector("#origField");
    const destField = formElement.querySelector("#destField");

    origField.addEventListener('click', function (event) {
        console.log(`origField clicked: ${e.latlng}`);
        map.closePopup(popup);
    });

    destField.addEventListener('click', function (event) {
        console.log(`destField clicked: ${e.latlng}`);
        map.closePopup(popup);
    });
});






const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const origCoords = document.querySelector(".orig-coords");
origCoords.value = "Startkoordinaten: "
const destCoords = document.querySelector(".dest-coords");
destCoords.value = "Zielkoordinaten: "
const searchButton = document.querySelector(".run-search");
const slider = document.querySelector(".slider");

let bestMobilityStationsPerVTTS = null;
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

function clearStationData() {
    stationMarkers.forEach((marker) => {
        marker.remove();
    });
    stationMarkers = [];
    bestMobilityStationsPerVTTS = null;
    checkForSlider();
}

function addMarkerToMap(point, object) {

    clearStationData();

    const display_name = object.properties.display_name;
    const coords = object.geometry.coordinates.reverse();

    if (point == "orig") {
        if (origMarker != null) {
            origMarker.remove();
        }
        title = `Startpunkt: ${display_name}`
        icon = origIcon;
        updateTextField(origCoords, `${origCoords.value}${coords[0]}, ${coords[1]}`)
    }
    else if (point == "dest") {
        if (destMarker != null) {
            destMarker.remove();
        }
        title = `Endpunkt: ${display_name}`;
        icon = destIcon;
        updateTextField(destCoords, `${destCoords.value}${coords[0]}, ${coords[1]}`)
    }

    const marker = L.marker(coords, {
        title: title,
        draggable: true,
        icon: icon,
    });

    marker.addTo(map).bindPopup(title);

    marker.on("dragend", function (e) {
        const coords = e.target.getLatLng();
        console.log(`dragend: ${coords}`)
        if (point == "orig") {
            field = origCoords;
            orig.value = "";
        }
        else if (point == "dest") {
            field = destCoords;
            dest.value = "";
        }
        updateTextField(field, `${field.value}${coords.lat}, ${coords.lng}`)
        checkForSearch();
        clearStationData();
        checkForSlider();

    });


    if (point == "orig") {
        origMarker = marker;
    }
    else if (point == "dest") {
        destMarker = marker;
    }

    checkForSearch();

}


function getBestMobilityStations() {

    clearStationData();

    // get result form an rest interface
    const api = `http://127.0.0.1:5000/api/get-best-mobility-stations?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${destMarker._latlng.lng}&dest_northing=${destMarker._latlng.lat}`;


    // fetch data
    fetch(api)
        .then((response) => response.json())
        .then((data) => {
            console.log(data)
            bestMobilityStationsPerVTTS = JSON.parse(data);
            if (checkForSlider()) {
                const vTTS = slider.value;
                showBestMobilityStations(vTTS);
            }
        })
}

function showBestMobilityStations(vTTS) {
    bestMobilityStations = bestMobilityStationsPerVTTS[vTTS];
    bestMobilityStations.forEach((station) => {
        stationName = station["Name"]
        easting = station["easting"]
        northing = station["northing"]
        marker = L.circleMarker([northing, easting], { fillColor: "red", color: "red" })
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


function updateTextField(element, newText) {
    element.textContent = newText;
}

function checkForSearch() {
    if (origMarker != null && destMarker != null) {
        searchButton.disabled = false;
        return true;
    }
    else {
        searchButton.disabled = true;
        return false;
    }
}

function checkForSlider() {
    if (bestMobilityStationsPerVTTS != null) {
        slider.disabled = false;
        return true;
    }
    else {
        slider.disabled = true;
        return false;
    }
}


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
                    updateTextField(origCoords, origCoords.value)
                    origMarker = null;
                }
                else if (point == "dest") {
                    destMarker.remove();
                    updateTextField(destCoords, destCoords.value)
                    destMarker = null;
                }
                checkForSearch();
                clearStationData();
                checkForSlider();
            },
            // the method presents no results
            noResults: ({ currentValue, template }) =>
                template(`<li>No results found: "${currentValue}"</li>`),
        });

    });
});