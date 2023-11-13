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


const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const origCoords = document.querySelector(".orig-coords");
origCoords.value = "Startkoordinaten: "
const destCoords = document.querySelector(".dest-coords");
destCoords.value = "Zielkoordinaten: "
const searchButton = document.querySelector(".run-search");
const slider = document.querySelector(".slider");


// Dynamic data
let queryData = null
let origMarker = null;
let destMarker = null;
let stationMarkers = [];
let polylineFeatureGroup = null;
let journeyInfo = null;
let xmlDocForTesting = null;


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
        updateTextField(origCoords, `${origCoords.value}${coords[0]}, ${coords[1]}`)
    }
    else if (origOrDest == "dest") {
        if (destMarker != null) {
            destMarker.remove();
        }
        title = `Endpunkt: ${popup_text}`;
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
        if (origOrDest == "orig") {
            field = origCoords;
            orig.value = "";
            text = `${origCoords.value}${coords.lat}, ${coords.lng}`
        }
        else if (origOrDest == "dest") {
            field = destCoords;
            dest.value = "";
            text = `${destCoords.value}${coords.lat}, ${coords.lng}`
        }
        e.target.setPopupContent(coords);
        updateTextField(field, text)
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
    ks = Object.keys(queryData['best_mobility_stations_costs_per_vtts']);
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
    const api = `http://127.0.0.1:5000/api/get-best-mobility-stations?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${destMarker._latlng.lng}&dest_northing=${destMarker._latlng.lat}`;
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

const apiKey = "eyJvcmciOiI2NDA2NTFhNTIyZmEwNTAwMDEyOWJiZTEiLCJpZCI6IjdjZjQ3OWViZjA5ZTRhZDQ5OTFiYzgyMzM0NjA5NzkwIiwiaCI6Im11cm11cjEyOCJ9"

const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/xml'
};


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
    bestZonesCosts = queryData['best_mobility_stations_costs_per_vtts'][vTTS];
    stationsPerZone = queryData['mobility_stations_per_zone'];
    infosPerStation = queryData['infos_per_mobility_station'];
    dataPerZone = queryData['data_per_zone'];
    initTable();
    const table = document.getElementById("table");
    bestZonesCosts.forEach((zoneCost) => {
        zone = zoneCost['zone_mobility_station'];
        cost = zoneCost['Costs'];
        ptJT = dataPerZone[zone]['pt_jt'];
        ptNT = dataPerZone[zone]['pt_nt'];
        ptDist = dataPerZone[zone]['pt_dist'];
        roadJT = dataPerZone[zone]['road_jt'];
        roadDist = dataPerZone[zone]['road_dist'];
        stationsPerZone[zone].forEach((stationNr) => {
            stNr = infosPerStation[stationNr]['station_nr']
            stName = infosPerStation[stationNr]['station_name']
            stEasting = infosPerStation[stationNr]['easting']
            stNorthing = infosPerStation[stationNr]['northing']

            // add column rows
            let row = table.insertRow();
            let firstCol = row.insertCell(0);
            firstCol.innerHTML = stName
            let secondCol = row.insertCell(1);
            secondCol.innerHTML = floatToHHMM(ptJT)
            let thirdCol = row.insertCell(2);
            thirdCol.innerHTML = ptNT.toFixed(1);
            let fourthCol = row.insertCell(3);
            fourthCol.innerHTML = ptDist.toFixed(0)
            let fifthCol = row.insertCell(4);
            fifthCol.innerHTML = floatToHHMM(roadJT);
            let sixthCol = row.insertCell(5);
            sixthCol.innerHTML = roadDist.toFixed(0);
            let seventhCol = row.insertCell(6);
            seventhCol.innerHTML = cost.toFixed(1);
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
                xmlDoc = getOJPTripRequestXMLObjetct(this_marker);
                const url_ojp = 'https://api.opentransportdata.swiss/ojp2020';
                xml_str = serializer.serializeToString(xmlDoc);
                axios.post(url_ojp, xml_str, { headers })
                .then(response => {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(response.data, "text/xml");
                    xmlDocForTesting = xmlDoc;
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
    });
}


slider.addEventListener("input", () => {
    showBestMobilityStations(getVTTSValue());
});


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
    if (queryData != null) {
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

            onSubmit: ({ object }) => onNewAddress(point, object),

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

const ojp_trip_request_template = `<?xml version="1.0" encoding="utf-8"?>
<OJP xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://www.siri.org.uk/siri" version="1.0" xmlns:ojp="http://www.vdv.de/ojp" xsi:schemaLocation="http://www.siri.org.uk/siri ../ojp-xsd-v1.0/OJP.xsd">
    <OJPRequest>
        <ServiceRequest>
            <RequestTimestamp>2023-12-04T09:10:32.267Z</RequestTimestamp>
            <RequestorRef>API-Explorer</RequestorRef>
            <ojp:OJPTripRequest>
                <RequestTimestamp>2023-12-04T09:10:32.267Z</RequestTimestamp>
                <ojp:Origin>
                    <ojp:PlaceRef>
                        <ojp:GeoPosition>
                            <Longitude>7.446683</Longitude>
                            <Latitude>46.928306</Latitude>
                        </ojp:GeoPosition>
                        <ojp:LocationName>
                            <ojp:Text>Start</ojp:Text>
                        </ojp:LocationName>
                    </ojp:PlaceRef>
                    <ojp:DepArrTime>2023-12-04T10:00:00</ojp:DepArrTime>
                </ojp:Origin>
                <ojp:Destination>
                    <ojp:PlaceRef>
                        <ojp:GeoPosition>
                            <Longitude>8.55408</Longitude>
                            <Latitude>47.36488</Latitude>
                        </ojp:GeoPosition>
                        <ojp:LocationName>
                            <ojp:Text>Ziel</ojp:Text>
                        </ojp:LocationName>
                    </ojp:PlaceRef>
                </ojp:Destination>
                <ojp:Params>
                    <ojp:IncludeTrackSections>true</ojp:IncludeTrackSections>
                    <ojp:IncludeLegProjection>true</ojp:IncludeLegProjection>
                    <ojp:IncludeTurnDescription></ojp:IncludeTurnDescription>
                    <ojp:IncludeIntermediateStops></ojp:IncludeIntermediateStops>
                </ojp:Params>
            </ojp:OJPTripRequest>
        </ServiceRequest>
    </OJPRequest>
</OJP>`;

const serializer = new XMLSerializer();

function setOriginCoordinates(xmlDoc) {
    const originNode = xmlDoc.getElementsByTagName("ojp:Origin")[0];
    const longitude = originNode.getElementsByTagName("Longitude")[0];
    const latitude = originNode.getElementsByTagName("Latitude")[0];
    longitude.textContent = origMarker.getLatLng().lng;
    latitude.textContent = origMarker.getLatLng().lat;
}

function setStationCoordinates(xmlDoc, marker) {
    const destinationNode = xmlDoc.getElementsByTagName("ojp:Destination")[0];
    const longitude = destinationNode.getElementsByTagName("Longitude")[0];
    const latitude = destinationNode.getElementsByTagName("Latitude")[0];
    const locationName = destinationNode.getElementsByTagName("ojp:LocationName")[0].getElementsByTagName("ojp:Text")[0];
    longitude.textContent = marker.getLatLng().lng;
    latitude.textContent = marker.getLatLng().lat;
    locationName.textContent = marker._popup._content;
}

function getOJPTripRequestXMLObjetct(marker) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ojp_trip_request_template, "text/xml");
    setOriginCoordinates(xmlDoc);
    setStationCoordinates(xmlDoc, marker);
    return xmlDoc;
}

