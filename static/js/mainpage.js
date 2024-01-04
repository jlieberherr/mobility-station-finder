/*
 * Mobility-Station-Finder
 */

const env = "production";
let apiUrl;

if (env === "production") {
  apiUrl = "http://mobility-station-finder.ch";
} else {
  apiUrl = "http://127.0.0.1:5000";
}

let config = {
  minZoom: 2,
  maxZoom: 18,
};
// magnification with which the map will start
const zoom = 9;
const lat = 46.800663464;
const lng = 8.222665776;

// calling map
const map = L.map("map", config).setView([lat, lng], zoom);

var origIcon = new L.Icon({
  iconUrl: "static/resources/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12.5, 41],
});

var destIcon = new L.Icon({
  iconUrl: "static/resources/marker-icon-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12.5, 41],
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

map.zoomControl.remove();
L.control.zoom({ position: 'topright' }).addTo(map);

var stateChangingButton = L.easyButton({
  states: [
    {
      stateName: "full-screen",
      icon: "fa-maximize",
      onClick: function (btn, map) {
        toggleScreen();
        btn.state("reduced-screen");
      },
    },
    {
      stateName: "reduced-screen",
      icon: "fa-minimize",
      onClick: function (btn, map) {
        toggleScreen();
        btn.state("full-screen");
      },
    },
  ],
}).setPosition('topright');
stateChangingButton.addTo(map);

var toggleTableButton = L.easyButton("fa-table", function (btn, map) {
  toggleTable();
}).addTo(map);
toggleTableButton.getContainer().id = "toggle-table-button";

// add easy button to map which zooms to the markers
var zoomButton = L.easyButton("fa-crosshairs", function (btn, map) {
  zoomMapToMarkers();
}).setPosition("topright");
zoomButton.addTo(map);
zoomButton.getContainer().id = "zoom-button";

function zoomMapToMarkers() {
  // only if there are markers
  if (Object.keys(stationMarkerPerId).length > 0) {
    // create feature group
    var group = new L.featureGroup(Object.values(stationMarkerPerId));
    map.fitBounds(group.getBounds());
  }
}

toggleTable();

const orig = document.querySelector("#orig");
const dest = document.querySelector("#dest");
const searchButton = document.querySelector(".run-search");
const timePicker = document.querySelector("#deptime");
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
timePicker.value = now.toISOString().slice(0, 16);

// Dynamic data
let queryData = null;
let origMarker = null;
let destMarker = null;
let stationMarkerPerId = {};
let xmlDocPTJourneyPerStationId = {};
let ptLegInfosPerStationId = {};
let roadDataPerStationId = {};
let roadInfosPerStationId = {};
let polylineFeatureGroup = null;

const sliderMap = L.control
  .slider(
    function (value) {
      if (queryData != null) {
        showBestMobilityStations(getVTTSValue());
      }
    },
    {
      max: 100,
      value: 50,
      step: 1,
      size: "250px",
      orientation: "vertical",
      collapsed: false,
      position: "topleft",
      title: "Zeitwert",
      id: "slider-map",
      showValue: false,
    }
  )
  .addTo(map);
checkForSlider();

// Add a contextmenu event listener to the map
map.on("contextmenu", function (e) {
  // Create the popup content
  const form = `
    <form>
      <label id="origField">Hier Startpunkt setzen</label>
      <br>
      <br>
      <label id="destField">Hier Zielpunkt setzen</label>
    </form>
  `;

  // Open the popup when the map is right-clicked
  const popup = L.popup().setLatLng(e.latlng).setContent(form).openOn(map);
  const formElement = popup.getElement().querySelector("form");

  const origField = formElement.querySelector("#origField");
  const destField = formElement.querySelector("#destField");

  origField.addEventListener("click", function (event) {
    setOrigMarker([e.latlng.lat, e.latlng.lng], e.latlng);
    map.closePopup(popup);
  });

  destField.addEventListener("click", function (event) {
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
    title = `Startpunkt: ${popup_text}`;
    icon = origIcon;
  } else if (origOrDest == "dest") {
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
    } else if (origOrDest == "dest") {
      dest.value = "";
    }
    e.target.setPopupContent(coords);
    checkForSearch();
    clearStationData();
    checkForSlider();
  });

  if (origOrDest == "orig") {
    origMarker = marker;
  } else if (origOrDest == "dest") {
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
  const api = `https://nominatim.openstreetmap.org/search?countrycodes=CH&format=geojson&limit=5&q=${encodeURI(
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
  }
  polylineFeatureGroup == null;
  // remove all station markers in stationMarkerPerId from map
  Object.keys(stationMarkerPerId).forEach((stationId) => {
    stationMarkerPerId[stationId].remove();
  });
  stationMarkerPerId = {};
}

function clearStationData() {
  clearStationMarkers();
  queryData = null;
  xmlDocPTJourneyPerStationId = {};
  ptLegInfosPerStationId = {};
  roadDataPerStationId = {};
  roadInfosPerStationId = {};
  checkForSlider();
  initTable();
}

function getVTTSValue() {
  ks = Object.keys(queryData["best_stations_costs_per_vtts"]);
  ind = Math.floor((sliderMap.slider.value / 100.0) * (ks.length - 1));
  return ks[ind];
}

function onNewAddress(point, object) {
  const display_name = object.properties.display_name;
  const coords = object.geometry.coordinates.reverse();
  setOrigOrStartMarker(point, coords, display_name);
}

function getBestMobilityStations() {
  showLoadingSpinner();
  clearStationData();
  // get result form an rest interface
  const api = `${apiUrl}/api/get-best-mobility-stations?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${destMarker._latlng.lng}&dest_northing=${destMarker._latlng.lat}`;
  fetch(api)
    .then((response) => {
      hideLoadingSpinner();
      if (response.status == 500) {
        alert(
          "Es ist ein unbekannter Fehler aufgetreten. Bitte versuchen Sie es mit anderen Start- und Zielkoordinaten oder versuchen Sie es später erneut."
        );
        throw new Error(response);
      } else if (response.status == 550) {
        alert("Startpunkt liegt ausserhalb des zulässigen Bereichs");
      } else if (response.status == 551) {
        alert("Zielpunkt liegt ausserhalb des zulässigen Bereichs");
      } else if (response.status == 552) {
        alert(
          "Strassenrouting nicht erfolgreich. Bitte versuchen Sie es mit anderen Start- und Zielkoordinaten oder versuchen Sie es später erneut."
        );
      }
      return response.json();
    })
    .then((data) => {
      queryData = JSON.parse(data);
      if (checkForSlider()) {
        showMobilityStations();
        showBestMobilityStations(getVTTSValue());
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

function getTypeOfTripLeg(tripLeg) {
  // check if "ojp:ContinuousLeg" is in the tripLeg
  if (tripLeg.getElementsByTagName("ojp:ContinuousLeg").length > 0) {
    return "ContinuousLeg";
  } else if (tripLeg.getElementsByTagName("ojp:TimedLeg").length > 0) {
    return "TimedLeg";
  } else if (tripLeg.getElementsByTagName("ojp:TransferLeg").length > 0) {
    return "TransferLeg";
  } else {
    console.log("Error: Unknown type of trip leg: " + tripLeg);
  }
}

function floatToHHMM(timeInMin) {
  hours = timeInMin / 60;
  var hh = Math.floor(hours);
  var mm = Math.round((hours - hh) * 60.0);

  mm = mm < 10 ? "0" + mm : mm;
  hh = hh < 10 ? "0" + hh : hh;

  return hh + ":" + mm;
}

function initTable() {
  const table = document.getElementById("table");
  var rows = table.getElementsByTagName("tr");
  for (var i = rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }
}

function getPTLegInfosPerStationId(xmlDoc, stationId) {
  // iterate over all trips
  const trip = xmlDoc.getElementsByTagName("ojp:TripResult")[0];
  const tripLegs = trip.getElementsByTagName("ojp:TripLeg");
  var ptInfos = [];
  for (let i = 0; i < tripLegs.length; i++) {
    const tripLeg = tripLegs[i];
    const legType = getTypeOfTripLeg(tripLeg);
    if (legType == "ContinuousLeg" || legType == "TimedLeg") {
      if (legType == "ContinuousLeg") {
        const continousLeg =
          tripLeg.getElementsByTagName("ojp:ContinuousLeg")[0];
        const legMode = continousLeg
          .getElementsByTagName("ojp:Service")[0]
          .getElementsByTagName("ojp:IndividualMode")[0].textContent;
        const legStart = continousLeg.getElementsByTagName("ojp:LegStart")[0];
        const startName = legStart
          .getElementsByTagName("ojp:LocationName")[0]
          .getElementsByTagName("ojp:Text")[0].textContent;
        const legEnd = continousLeg.getElementsByTagName("ojp:LegEnd")[0];
        const endName = legEnd
          .getElementsByTagName("ojp:LocationName")[0]
          .getElementsByTagName("ojp:Text")[0].textContent;
        const startTime = new Date(
          continousLeg.getElementsByTagName(
            "ojp:TimeWindowStart"
          )[0].textContent
        );
        const endTime = new Date(
          continousLeg.getElementsByTagName("ojp:TimeWindowEnd")[0].textContent
        );
        const legInfo = {
          legMode: legMode,
          startName: startName,
          endName: endName,
          startTime: startTime,
          endTime: endTime,
        };
        ptInfos.push(legInfo);
      } else {
        const timedLeg = tripLeg.getElementsByTagName("ojp:TimedLeg")[0];
        const legMode = timedLeg
          .getElementsByTagName("ojp:Service")[0]
          .getElementsByTagName("ojp:Mode")[0]
          .getElementsByTagName("ojp:Name")[0]
          .getElementsByTagName("ojp:Text")[0].textContent;
        const legBoard = timedLeg.getElementsByTagName("ojp:LegBoard")[0];
        const startName = legBoard
          .getElementsByTagName("ojp:StopPointName")[0]
          .getElementsByTagName("ojp:Text")[0].textContent;
        const startTime = new Date(
          legBoard
            .getElementsByTagName("ojp:ServiceDeparture")[0]
            .getElementsByTagName("ojp:TimetabledTime")[0].textContent
        );
        const legAlight = timedLeg.getElementsByTagName("ojp:LegAlight")[0];
        const endName = legAlight
          .getElementsByTagName("ojp:StopPointName")[0]
          .getElementsByTagName("ojp:Text")[0].textContent;
        const endTime = new Date(
          legAlight
            .getElementsByTagName("ojp:ServiceArrival")[0]
            .getElementsByTagName("ojp:TimetabledTime")[0].textContent
        );
        const legInfo = {
          legMode: legMode,
          startName: startName,
          endName: endName,
          startTime: startTime,
          endTime: endTime,
        };
        ptInfos.push(legInfo);
      }
    } else if (legType == "TransferLeg") {
      // TODO
    } else {
      console.log("Error: Unknown type of trip leg: " + tripLeg);
    }
  }
  return ptInfos;
}

function showPTJourney(xmlDoc) {
  // iterate over all trips
  const trip = xmlDoc.getElementsByTagName("ojp:TripResult")[0];
  const tripLegs = trip.getElementsByTagName("ojp:TripLeg");
  for (let i = 0; i < tripLegs.length; i++) {
    const tripLeg = tripLegs[i];
    const legType = getTypeOfTripLeg(tripLeg);
    var color = null;
    if (legType == "ContinuousLeg" || legType == "TimedLeg") {
      if (legType == "ContinuousLeg") {
        color = "green";
      } else {
        color = "blue";
      }
      // add polyline with all positions to map
      const positions = tripLeg.getElementsByTagName("ojp:Position");
      var pointList = [];
      for (let j = 0; j < positions.length; j++) {
        var position = positions[j];
        var easting =
          position.getElementsByTagName("siri:Longitude")[0].textContent;
        var northing =
          position.getElementsByTagName("siri:Latitude")[0].textContent;
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
  }
}

function showRoadJourney(data) {
  var pointList = [];
  const coords = data["routes"][0]["geometry"]["coordinates"];
  for (let i = 0; i < coords.length; i++) {
    var point = new L.LatLng(coords[i][1], coords[i][0]);
    pointList.push(point);
  }
  var polyline = new L.polyline(pointList, {
    color: "red",
  });
  polylineFeatureGroup.addLayer(polyline);
}

function showModal(stationId) {
  // show modal if stationId is in ptLegInfosPerStationId and roadInfosPerStationId
  if (
    stationId in ptLegInfosPerStationId &&
    stationId in roadInfosPerStationId
  ) {
    // show data in ptInfos in a modal
    ptInfos = ptLegInfosPerStationId[stationId];
    roadInfos = roadInfosPerStationId[stationId];
    var ptInfosTable = "";
    ptInfos.forEach((ptInfo) => {
      ptInfosTable += 
      `<tr>
        <td>${ptInfo["legMode"]}</td>
        <td>${ptInfo["startName"]}</td>
        <td>${ptInfo["startTime"].toLocaleTimeString("de-CH")}</td>
        <td>${ptInfo["endName"]}</td>
        <td>${ptInfo["endTime"].toLocaleTimeString("de-CH")}</td>
      </tr>`;
    });
    var roadInfosTable = `<tr><td>${roadInfos["startName"]}</td><td>${
      roadInfos["endName"]
    }</td><td>${floatToHHMM(roadInfos["duration"])}</td><td>${roadInfos[
      "distance"
    ].toFixed(2)} km</td></tr>`;
    var modal = document.getElementById("journey-info-modal");
    var modalContent = document.getElementById("journey-info-modal-content");
    modalContent.innerHTML = `
<div class="modal-header">
<span class="close">&times;</span>  
</div>
<div class="modal-body">
  <h2>Weg zur Mobility-Station</h2>
  <table>
    <tr>
      <th>Verkehrsmittel</th>
      <th>Start</th>
      <th>Abfahrt</th>
      <th>Ziel</th>
      <th>Ankunft</th>
    </tr>
    ${ptInfosTable}
  </table>
  <br>
  <h2>Weg mit Mobility</h2>
  <table>
    <tr>
      <th>Start</th>
      <th>Ziel</th>
      <th>Dauer</th>
      <th>Distanz</th>
    </tr>
    ${roadInfosTable}
  </table>
</div>
`;
    modal.style.display = "block";
    var span = document.getElementsByClassName("close")[0];
    span.onclick = function () {
      modal.style.display = "none";
    };
    window.onclick = function (event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    };
  }
}

function showMobilityStations() {
  clearStationMarkers();
  const dataPerStationId = queryData["data_per_station_id"];
  // iterate over all stations
  Object.keys(dataPerStationId).forEach((stationId) => {
    stName = dataPerStationId[stationId]["Name"];
    stEasting = dataPerStationId[stationId]["easting"];
    stNorthing = dataPerStationId[stationId]["northing"];

    // add markers
    marker = L.circleMarker([stNorthing, stEasting], {
      fillColor: "grey",
      color: "grey",
      id: stationId,
    });
    stationMarkerPerId[stationId] = marker;
    marker.addTo(map).bindPopup(stName);
    marker.addEventListener("click", (e) => {
      showLoadingSpinner();
      var ojpRequestTerminated = false;
      var osrmRequestTerminated = false;
      // init polylineFeatureGroup
      if (polylineFeatureGroup != null) {
        // remove polylineFeatureGroup from map
        polylineFeatureGroup.remove();
        // create new polylineFeatureGroup
      }
      polylineFeatureGroup = L.featureGroup();
      var this_marker = e.target;
      const stationId = this_marker.options.id;
      // check if stationId is in xmlDocPTJourneyPerStationId
      if (stationId in xmlDocPTJourneyPerStationId) {
        ojpRequestTerminated = true;
        if (osrmRequestTerminated) {
          hideLoadingSpinner();
        }
        showPTJourney(xmlDocPTJourneyPerStationId[stationId]);
      } else {
        const api_ojp = `${apiUrl}/api/ojp-request?orig_easting=${origMarker._latlng.lng}&orig_northing=${origMarker._latlng.lat}&dest_easting=${this_marker._latlng.lng}&dest_northing=${this_marker._latlng.lat}&dep_time=${timePicker.value}`;
        fetch(api_ojp)
          .then((response) => {
            if (!response.ok) {
              alert(
                "Beim Abfragen der öV-Verbindung ist ein Fehler aufgetreten"
              );
              throw new Error("OJP request failed");
            }
            return response.json();
          })
          .then((data) => {
            ojpRequestTerminated = true;
            if (osrmRequestTerminated) {
              hideLoadingSpinner();
            }
            xmlDocString = JSON.parse(data)["xml_str"];
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlDocString, "text/xml");
            xmlDocPTJourneyPerStationId[stationId] = xmlDoc;
            ptLegInfosPerStationId[stationId] = getPTLegInfosPerStationId(
              xmlDoc,
              stationId
            );
            showPTJourney(xmlDoc);
            showModal(stationId);
          })
          .catch((error) => {
            console.error(error);
          });
      }
      if (stationId in roadDataPerStationId) {
        osrmRequestTerminated = true;
        if (ojpRequestTerminated) {
          hideLoadingSpinner();
        }
        showRoadJourney(roadDataPerStationId[stationId]);
      } else {
        var stationEasting = this_marker.getLatLng().lng;
        var stationNorthing = this_marker.getLatLng().lat;
        var destEasting = destMarker.getLatLng().lng;
        var destNorthing = destMarker.getLatLng().lat;
        const url_orm = `https://router.project-osrm.org/route/v1/driving/${stationEasting},${stationNorthing};${destEasting},${destNorthing}?geometries=geojson`;
        fetch(url_orm)
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            osrmRequestTerminated = true;
            if (ojpRequestTerminated) {
              hideLoadingSpinner();
            }
            roadDataPerStationId[stationId] = data;
            const duration = parseFloat(data["routes"][0]["duration"]) / 60.0;
            const distance = parseFloat(data["routes"][0]["distance"]) / 1000.0;
            roadInfosPerStationId[stationId] = {
              startName: this_marker._popup._content,
              endName: destMarker._popup._content,
              duration: duration,
              distance: distance,
            };
            showRoadJourney(data);
            showModal(stationId);
          })
          .catch((error) => {
            console.error(error);
          });
      }

      polylineFeatureGroup.addTo(map);
      showModal(stationId);
    });
  });
  zoomMapToMarkers();
}

function showBestMobilityStations(vTTS) {
  bestStationsCosts = queryData["best_stations_costs_per_vtts"][vTTS];
  dataPerStationId = queryData["data_per_station_id"];
  initTable();
  // set all markers to red
  Object.keys(stationMarkerPerId).forEach((stationId) => {
    stationMarkerPerId[stationId].setStyle({
      fillColor: "grey",
      color: "grey",
    });
  });
  const table = document.getElementById("table");
  bestStationsCosts
    .sort(function (a, b) {
      return parseFloat(a.Costs) - parseFloat(b.Costs);
    })
    .forEach((stationCost) => {
      stationId = stationCost["Stationsnummer"];
      // change color of marker
      stationMarkerPerId[stationId].setStyle({
        fillColor: "red",
        color: "red",
      });
      cost = stationCost["Costs"];
      nonFootPenalty = dataPerStationId[stationId]["factor_not_foot"];
      ptJT = dataPerStationId[stationId]["pt_jt"];
      ptNT = dataPerStationId[stationId]["pt_nt"];
      ptDist = dataPerStationId[stationId]["pt_dist"];
      roadJT = dataPerStationId[stationId]["road_jt"];
      roadDist = dataPerStationId[stationId]["road_dist"];
      stName = dataPerStationId[stationId]["Name"];
      stEasting = dataPerStationId[stationId]["easting"];
      stNorthing = dataPerStationId[stationId]["northing"];

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
    });
}

timePicker.addEventListener("change", () => {
  checkForSearch();
  clearStationData();
  checkForSlider();
});

searchButton.addEventListener("click", () => {
  // get best mobility stations
  getBestMobilityStations();
});

function checkForSearch() {
  if (origMarker != null && destMarker != null && timePicker.value != "") {
    searchButton.disabled = false;
    return true;
  } else {
    searchButton.disabled = true;
    return false;
  }
}

function checkForSlider() {
  if (queryData != null) {
    document.querySelector('.leaflet-control-slider').style.display = 'block';
    document.getElementById("toggle-table-button").style.display = "block";
    document.getElementById("zoom-button").style.display = "block";
    return true;
  } else {
    document.querySelector('.leaflet-control-slider').style.display = 'none';
    document.getElementById("toggle-table-button").style.display = "none";
    document.getElementById("zoom-button").style.display = "none";
    return false;
  }
}

function toggleTable() {
  var table = document.getElementById("overview");
  if (table.style.display === "none") {
    table.style.display = "block"; // Show the table
    map.invalidateSize(); // Trigger map redraw
  } else {
    table.style.display = "none"; // Hide the table
    map.invalidateSize(); // Trigger map redraw
  }
}

function toggleScreen() {
  var origDest = document.getElementById("orig-dest");
  if (origDest.style.display === "none") {
    origDest.style.display = "flex"; //
    map.invalidateSize(); // Trigger map redraw
  } else {
    origDest.style.display = "none";
    map.invalidateSize(); // Trigger map redraw
  }
}

function showLoadingSpinner() {
  document.getElementById("loading-spinner").style.display = "block";
}

function hideLoadingSpinner() {
  document.getElementById("loading-spinner").style.display = "none";
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
        } else if (point == "dest") {
          destMarker.remove();
          destMarker = null;
        }
        checkForSearch();
        clearStationData();
        checkForSlider();
      },
      noResults: ({ currentValue, template }) =>
        template(`<li>No results found: "${currentValue}"</li>`),
    });
  });
});
