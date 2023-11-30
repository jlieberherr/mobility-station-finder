/*
 * Mobility-Station-Finder
 */

// config map

const env = "production";
let apiUrl;

if (env === 'production') {
  apiUrl = 'http://mobility-station-finder.ch';
} else {
  apiUrl = 'http://127.0.0.1:5000';
}

let config = {
    minZoom: 2,
    maxZoom: 18,
    fullscreenControl: true,
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
    iconSize: [25, 41],
    iconAnchor: [12.5, 41]
});

var destIcon = new L.Icon({
    iconUrl: 'static/resources/marker-icon-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12.5, 41]
});

// Used to load and display tile layers on the map
// Most tile servers require attribution, which you can set under `Layer`
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);


var tableButton = L.Control.extend({
    onAdd: function(map) {
        var button = L.DomUtil.create('button', 'table-button');
        button.innerHTML = '<i class="fa fa-table"></i>';
        button.onclick = function() {
            toggleTable();
        };
        return button;
    }
});

map.addControl(new tableButton({ position: 'topright' }));

toggleTable();

const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const searchButton = document.querySelector(".run-search");
const slider = document.querySelector(".slider");
const timePicker = document.querySelector("#deptime");
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
timePicker.value = now.toISOString().slice(0, 16);

// Dynamic data
let queryData = null;
let origMarker = null;
let destMarker = null;
let stationMarkers = [];
let polylineFeatureGroup = null;
let journeyInfo = null;


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
        setOrigMarker([e.latlng.lat, e.latlng.lng], e.latlng);
        map.closePopup(popup);
    });

    destField.addEventListener('click', function (event) {
        setDestMarker([e.latlng.lat, e.latlng.lng], e.latlng);
        map.closePopup(popup);
    });
});


function setOrigMarker(coords, popup_text) {
    setOrigOrStartMarker("orig", coords, popup_text);
}


function setDestMarker(coords, popup_text) {
    setOrigOrStartMarker("dest", coords, popup_text);
}


function setOrigOrStartMarker(origOrDest, coords, popup_text) {
    clearStationData();
    if (origOrDest == "orig") {
        if (origMarker != null) {
            origMarker.remove();
        }
        title = `Startpunkt: ${popup_text}`
        icon = origIcon;
    }
    else if (origOrDest == "dest") {
        if (destMarker != null) {
            destMarker.remove();
        }
        title = `Endpunkt: ${popup_text}`;
        icon = destIcon;
    }
    const marker = L.marker(coords, {
        title: title,
        draggable: true,
        icon: icon,
    });

    marker.addTo(map).bindPopup(title);

    marker.on("dragend", function (e) {
        const coords = e.target.getLatLng();
        if (origOrDest == "orig") {
            orig.value = "";
        }
        else if (origOrDest == "dest") {
            dest.value = "";
        }
        e.target.setPopupContent(coords);
        checkForSearch();
        clearStationData();
        checkForSlider();

    });

    if (origOrDest == "orig") {
        origMarker = marker;
    }
    else if (origOrDest == "dest") {
        destMarker = marker;
    }
    checkForSearch();
}


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


function clearStationMarkers() {
    if (polylineFeatureGroup != null) {
        polylineFeatureGroup.remove();
    };
    polylineFeatureGroup == null;
    stationMarkers.forEach((marker) => {
        marker.remove();
    });
    stationMarkers = [];
}


function clearStationData() {
    clearStationMarkers();
    queryData = null;
    checkForSlider();
    initTable();
}

function getVTTSValue() {
    ks = Object.keys(queryData['best_stations_costs_per_vtts']);
    ind = Math.floor(slider.value / 100.0 * (ks.length - 1));
    return ks[ind];
}


function onNewAddress(point, object) {
    const display_name = object.properties.display_name;
    const coords = object.geometry.coordinates.reverse();
    setOrigOrStartMarker(point, coords, display_name);
}


function getBestMobilityStations() {
    clearStationData();
    // get result form an rest interface
    const api = `${apiUrl}/api/get-best-mobility-stations?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${destMarker._latlng.lng}&dest_northing=${destMarker._latlng.lat}`;
    // fetch data
    fetch(api)
        .then((response) => {
            if (response.status == 500) {
                alert("Es ist ein unbekannter Fehler aufgetreten. Bitte versuchen Sie es mit anderen Start- und Zielkoordinaten oder versuchen Sie es später erneut.");
                throw new Error(response);
            }
            else if (response.status == 550) {
                alert("Startpunkt liegt ausserhalb des zulässigen Bereichs")
            }
            else if (response.status == 551) {
                alert("Zielpunkt liegt ausserhalb des zulässigen Bereichs")
            }
            else if (response.status == 552) {
                alert("Strassenrouting nicht erfolgreich. Bitte versuchen Sie es mit anderen Start- und Zielkoordinaten oder versuchen Sie es später erneut.")
            };
            return response.json();})
        .then((data) => {
            queryData = JSON.parse(data);
            if (checkForSlider()) {
                showBestMobilityStations(getVTTSValue());
            }
        })
        .catch((error) => {
            console.error(error);
        });
}

function getTypeOfTripLeg(tripLeg){
    // check if "ojp:ContinuousLeg" is in the tripLeg
    if (tripLeg.getElementsByTagName("ojp:ContinuousLeg").length > 0) {
        return "ContinuousLeg";
    } else if (tripLeg.getElementsByTagName("ojp:TimedLeg").length > 0) {
        return "TimedLeg";
    } else if (tripLeg.getElementsByTagName("ojp:TransferLeg").length > 0) {
        return "TransferLeg";
    } else {console.log("Error: Unknown type of trip leg: " + tripLeg)};
}

function floatToHHMM(timeInMin) {
    hours = timeInMin / 60;
    var hh = Math.floor(hours);
    var mm = Math.round((hours - hh) * 60.0);
    
    mm = mm < 10 ? '0' + mm : mm;
    hh = hh < 10 ? '0' + hh : hh;
    
    return hh + ':' + mm;
}

function initTable() {
    const table = document.getElementById("table");
    var rows = table.getElementsByTagName("tr")
    for (var i = rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }
}

function showBestMobilityStations(vTTS) {
    clearStationMarkers();
    bestStationsCosts = queryData['best_stations_costs_per_vtts'][vTTS];
    dataPerStationId = queryData['data_per_station_id'];
    initTable();
    const table = document.getElementById("table");
    bestStationsCosts.sort(function(a, b) {
        return parseFloat(a.Costs) - parseFloat(b.Costs);}).forEach((stationCost) => {
        stationId = stationCost['Stationsnummer'];
        cost = stationCost['Costs'];
        nonFootPenalty = dataPerStationId[stationId]['factor_not_foot'];
        ptJT = dataPerStationId[stationId]['pt_jt'];
        ptNT = dataPerStationId[stationId]['pt_nt'];
        ptDist = dataPerStationId[stationId]['pt_dist'];
        roadJT = dataPerStationId[stationId]['road_jt'];
        roadDist = dataPerStationId[stationId]['road_dist'];
        stName = dataPerStationId[stationId]['Name']
        stEasting = dataPerStationId[stationId]['easting']
        stNorthing = dataPerStationId[stationId]['northing']

        // add column rows
        let row = table.insertRow();
        let firstCol = row.insertCell(0);
        firstCol.innerHTML = stName;
        let secondCol = row.insertCell(1);
        secondCol.innerHTML = nonFootPenalty.toFixed(2);
        let thirdCol = row.insertCell(2);
        thirdCol.innerHTML = floatToHHMM(ptJT);
        let fourthCol = row.insertCell(3);
        fourthCol.innerHTML = ptNT.toFixed(2);
        let fifthCol = row.insertCell(4);
        fifthCol.innerHTML = ptDist.toFixed(2);
        let sixthCol = row.insertCell(5);
        sixthCol.innerHTML = floatToHHMM(roadJT);
        let seventhCol = row.insertCell(6);
        seventhCol.innerHTML = roadDist.toFixed(2);
        let eighthCol = row.insertCell(7);
        eighthCol.innerHTML = cost.toFixed(1);
            
        // add markers
        marker = L.circleMarker([stNorthing, stEasting], { fillColor: "red", color: "red" })
        stationMarkers.push(marker)
        marker.addTo(map).bindPopup(stName);
        marker.addEventListener("click", (e) => {
            // init polylineFeatureGroup
            if (polylineFeatureGroup != null) {
                // remove polylineFeatureGroup from map
                polylineFeatureGroup.remove();
                // create new polylineFeatureGroup
            }
            polylineFeatureGroup = L.featureGroup();
            journeyInfo = {};
            ptInfos = [];
            var this_marker = e.target;

            const api_ojp = `${apiUrl}/api/ojp-request?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${this_marker._latlng.lng}&dest_northing=${this_marker._latlng.lat}&dep_time=${timePicker.value}`;
            fetch(api_ojp)
            .then(response => {
                if (!response.ok) {
                    alert("Beim Abfragen der öV-Verbindung ist ein Fehler aufgetreten");
                    throw new Error("OJP request failed");
                }
                return response.json();
            })
            .then((data) => {
                xmlDocString = JSON.parse(data)['xml_str'];
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlDocString, "text/xml");
                // iterate over all trips
                const trip = xmlDoc.getElementsByTagName("ojp:TripResult")[0];
                const tripLegs = trip.getElementsByTagName("ojp:TripLeg");
                for (let i = 0; i < tripLegs.length; i++) {
                    tripLeg = tripLegs[i];
                    const legType = getTypeOfTripLeg(tripLeg);
                    var color = null;
                    if (legType == "ContinuousLeg" || legType == "TimedLeg") {
                        if (legType == "ContinuousLeg") {
                            color = "green";
                            const continousLeg = tripLeg.getElementsByTagName("ojp:ContinuousLeg")[0];
                            const legMode = continousLeg.getElementsByTagName("ojp:Service")[0].getElementsByTagName("ojp:IndividualMode")[0].textContent;
                            const legStart = continousLeg.getElementsByTagName("ojp:LegStart")[0];
                            const startName = legStart.getElementsByTagName("ojp:LocationName")[0].getElementsByTagName("ojp:Text")[0].textContent;
                            const legEnd = continousLeg.getElementsByTagName("ojp:LegEnd")[0];
                            const endName = legEnd.getElementsByTagName("ojp:LocationName")[0].getElementsByTagName("ojp:Text")[0].textContent;
                            const startTime = new Date(continousLeg.getElementsByTagName("ojp:TimeWindowStart")[0].textContent);
                            const endTime = new Date(continousLeg.getElementsByTagName("ojp:TimeWindowEnd")[0].textContent);
                            const legInfo = {"legMode": legMode, "startName": startName, "endName": endName, "startTime": startTime, "endTime": endTime};
                            ptInfos.push(legInfo);
                        } else {
                            color = "blue"
                            const timedLeg = tripLeg.getElementsByTagName("ojp:TimedLeg")[0];
                            const legMode = timedLeg.getElementsByTagName("ojp:Service")[0].getElementsByTagName("ojp:Mode")[0].getElementsByTagName("ojp:Name")[0].getElementsByTagName("ojp:Text")[0].textContent;
                            const legBoard = timedLeg.getElementsByTagName("ojp:LegBoard")[0];
                            const startName = legBoard.getElementsByTagName("ojp:StopPointName")[0].getElementsByTagName("ojp:Text")[0].textContent;
                            const startTime = new Date(legBoard.getElementsByTagName("ojp:ServiceDeparture")[0].getElementsByTagName("ojp:TimetabledTime")[0].textContent);
                            const legAlight = timedLeg.getElementsByTagName("ojp:LegAlight")[0];
                            const endName = legAlight.getElementsByTagName("ojp:StopPointName")[0].getElementsByTagName("ojp:Text")[0].textContent;
                            const endTime = new Date(legAlight.getElementsByTagName("ojp:ServiceArrival")[0].getElementsByTagName("ojp:TimetabledTime")[0].textContent);
                            const legInfo = {"legMode": legMode, "startName": startName, "endName": endName, "startTime": startTime, "endTime": endTime};
                            ptInfos.push(legInfo);
                        };
                        // add polyline with all positions to map
                        const positions = tripLeg.getElementsByTagName("ojp:Position");
                        var pointList = [];
                        for (let j = 0; j < positions.length; j++) {
                            var position = positions[j];
                            var easting = position.getElementsByTagName("siri:Longitude")[0].textContent
                            var northing = position.getElementsByTagName("siri:Latitude")[0].textContent
                            var point = new L.LatLng(northing, easting);
                            // add point to pointList
                            pointList.push(point);
                        }
                        var polyline = new L.polyline(pointList, {
                            color: color,
                        });
                        polylineFeatureGroup.addLayer(polyline);
                    } else if (legType == "TransferLeg") {
                        // TODO
                    } else {
                        console.log("Error: Unknown type of trip leg: " + tripLeg);
                    }
                    journeyInfo["ptInfos"] = ptInfos;
                }
            })
            .catch(error => {
                console.error(error);
            });
            var stationEasting = this_marker.getLatLng().lng;
            var stationNorthing = this_marker.getLatLng().lat;
            var destEasting = destMarker.getLatLng().lng;
            var destNorthing = destMarker.getLatLng().lat;
            const url_orm = `http://router.project-osrm.org/route/v1/driving/${stationEasting},${stationNorthing};${destEasting},${destNorthing}?geometries=geojson`;
            fetch(url_orm)
            .then((response) => {
                return response.json();})
            .then((data) => {
                var pointList = [];
                const coords = data["routes"][0]["geometry"]["coordinates"];
                const duration = parseFloat(data["routes"][0]["duration"]) / 60.0;
                const distance = parseFloat(data["routes"][0]["distance"]) / 1000.0;
                journeyInfo["mobilityInfos"] = {"startName": this_marker._popup._content, "endName": destMarker._popup._content, "duration": duration, "distance": distance};
                for (let i = 0; i < coords.length; i++) {
                    var point = new L.LatLng(coords[i][1], coords[i][0]);
                    pointList.push(point);
                };
                var polyline = new L.polyline(pointList, {
                    color: "red",
                });
                polylineFeatureGroup.addLayer(polyline);
            })
            .catch((error) => {
                console.error(error);
            });
            polylineFeatureGroup.addTo(map);
        });

        });
}


slider.addEventListener("input", () => {
    showBestMobilityStations(getVTTSValue());
});

timePicker.addEventListener("change", () => {
    checkForSearch();
});


searchButton.addEventListener("click", () => {
    // get best mobility stations
    getBestMobilityStations();
});



function checkForSearch() {
    if (origMarker != null && destMarker != null && timePicker.value != '') {
        searchButton.disabled = false;
        return true;
    }
    else {
        searchButton.disabled = true;
        return false;
    }
}


function checkForSlider() {
    if (queryData != null) {
        slider.disabled = false;
        return true;
    }
    else {
        slider.disabled = true;
        return false;
    }
}

function toggleTable() {
    var table = document.getElementById('overview');
    if (table.style.display === 'none') {
      table.style.display = 'block'; // Show the table
      map.invalidateSize(); // Trigger map redraw
    } else {
      table.style.display = 'none'; // Hide the table
      map.invalidateSize(); // Trigger map redraw
    }
  }


window.addEventListener("DOMContentLoaded", function () {

    ["orig", "dest"].forEach((point) => {
        const auto = new Autocomplete(point, {
            searchButton: false,
            howManyCharacters: 2,

            onSearch: ({ currentValue }) => nominatim(currentValue),

            onResults: (object) => results(object),

            onSubmit: ({ object }) => onNewAddress(point, object),

            onReset: () => {
                if (point == "orig") {
                    origMarker.remove();
                    origMarker = null;
                }
                else if (point == "dest") {
                    destMarker.remove();
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

