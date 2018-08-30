$(document).ready(function() {
    $.getJSON("http://demos.fmeserver.com.s3.amazonaws.com/server-demo-config.json", function(config) {
        initialize(config.initObject);
   });
});
function initialize(initObject) {
    document.getElementById('dropdowns').style.display = 'none';
    document.getElementById('mapPage').style.display = 'none';

    //initialize behaviour for file upload
    $('#fileupload').fileupload({
        url : initObject.server + '/fmedataupload/' + 'EasyGeocoder' + '/' +  'GenerateSchemaElements.fmw?opt_fullpath=true',
        headers : {'Authorization' : 'fmetoken token=' + initObject.token},
        dropzone : $('#dropzone'),
        autoUpload : true,

        add: function (e, data) {
            data.submit();
        },

        done : function(e, data) {
            var fileName
            //when file has been uploaded, capture file name and JSON response from FME Server
            //and use full file path to run workspace
            $.each(data.files, function (index, file) {
                fileName = file.name
            });
            var filePath = data.result.serviceResponse.files.folder[0].path + '/' + fileName;
            geocoder.requestSchema(filePath);
        },

        fail : function(e, data){
            //do something if there was an error in uploading
        },

        dragover : function(e, data) {
            //make dropzone prettier
            var dropZone = $('#dropzone');
            var timeout = window.dropZoneTimeout;

            if (!timeout) {
                dropZone.addClass('in');
            }
            else {
                clearTimeout(timeout);
            }

            var found = false;
            var node = e.target;
            do {
                if (node === dropZone[0]) {
                    found = true;
                    break;
                }
                node = node.parentNode;
            }
            while (node !== null);
            if (found) {
                dropZone.addClass('hover');
            }
            else {
                dropZone.removeClass('hover');
            }
            window.dropZoneTimeout = setTimeout(function() {
                window.dropZoneTimeout = null;
                dropZone.removeClass('in hover');
            }, 100);
        }
    });

    geocoder.init({
        host : initObject.server,
        token : initObject.token
    });
}

var geocoder = (function() {

    //private
    var schemaWorkspace = 'GenerateSchemaElements.fmw';
    var geocodeWorkspace = 'CallGeocoder_2.fmw';
    var repository = 'EasyGeocoder';
    var host;
    var token;
    var layer, map;
    var loading;

    function createComboBox(boxName, colList) {
        var html = '<select id="' + boxName + '">';
        //populate selection choices
        var colCount = colList.columns.length;
        html = html + '<option selected="true" style="display:none;" value=" ">Choose a Field</option>'
        html = html + '<option value=" "> --N/A-- </option>';
        for (i = 0; i< colCount; i++){
            html = html + '<option value="' + colList.columns[i] + '">' + colList.columns[i] + '</option>';
        }
        html = html + '</select>';
        return html;
    }

    function displayNextStep(colList) {
        document.getElementById('content').style.display = 'none';
        document.getElementById('dropdowns').style.display = 'block';

        //take the list of csv columns and create a set of dropdown menus
        //to set the parameters for the next workspace
        document.getElementById("address").innerHTML = createComboBox("Address_field", colList);
        document.getElementById("city").innerHTML = createComboBox("City_field", colList);
        document.getElementById("state").innerHTML = createComboBox("StateProvince_field", colList);
        document.getElementById("postalcode").innerHTML = createComboBox("PostalCode_field", colList);
        document.getElementById("country").innerHTML = createComboBox("Country_field", colList);
    }

    function getParams() {
        var address = document.getElementById("address").value;
        var city = document.getElementById("city").value;
        var province = document.getElementById("state").value;
        var postalcode = document.getElementById("postalcode").value;
        var country = document.getElementById("country").value;

        var params = 'SourceDataset=' + fileLocation;
        params = params + '&AddressAttr=' + address;
        params = params + '&CityAttr=' + city;
        params = params + '&ProvinceAttr=' + province;
        params = params + '&PostalCodeAttr=' + postalcode;
        params = params + '&CountryAttr=' + country;

        var encodedParams = encodeURI(params);

        return encodedParams;
    }
    // If the user presses the reset button, clear the dropdowns
    function clearDropdowns() {
        document.getElementById('address').innerHTML = '';
        document.getElementById('city').innerHTML = '';
        document.getElementById('state').innerHTML = '';
        document.getElementById('postalcode').innerHTML = '';
        document.getElementById('country').innerHTML = '';
    }

    function initMap() {
        //init map
        loading = new Image();
        loading.src = "libs/upload/img/spinner.gif";
        loading.id = "loadingImg";

        L.mapbox.accessToken = 'pk.eyJ1IjoibmF0aGFuYXRzYWZlIiwiYSI6ImNqazRqN2VuazA0dHczcXAyYjkyeTczcnUifQ.ZcD7wuTSCbsLRb_Y-drHjg';

        map = L.mapbox.map('mapDiv', 'mapbox.streets').setView([40,-105],4);
        map.once("ready", function() {
            map.invalidateSize();
            document.getElementById( "mapDiv" ).appendChild( loading )
        });
    };

    function dataLoadError() {
        //display a useful error message
        window.onerror = function(msg, url, linenumber) {
        alert('Error message: '+msg+'\nURL: '+url+'\nLine Number: '+linenumber);
        return true;
        }
    }

    //public methods
    return {

        init : function(params) {
            var self = this;
            host = params.host;
            token = params.token;

            FMEServer.init({
                server : host,
                token : token
            });
        },

        requestSchema : function(filePath) {
            fileLocation = filePath
            var params = 'SourceDataset_SCHEMA=' + filePath;
            var url = host + '/fmedatastreaming/' + repository + '/' + schemaWorkspace + '?' + params;
            FMEServer.customRequest(url, 'GET' ,displayNextStep);
        },
        // Reset button function
        backToUpload : function() {
            clearDropdowns();
            document.getElementById('dropdowns').style.display = 'none';
            document.getElementById('content').style.display = 'block';
        },
        // Restart button function
        restart : function() {
            window.location.reload();
        },
        //Add the data to the map
        displayMap : function() {
            var params = getParams();
            var url = host + '/fmedatastreaming/' + repository + '/'+ geocodeWorkspace + '?' + params + '&token=' + token;
            initMap();

            loading.style.display = 'block';

            layer = L.mapbox.featureLayer(url).on('ready', function() {
                map.fitBounds(layer.getBounds(), {maxZoom : 12});
                loading.style.display = 'none'
            }).addTo(map);

            document.getElementById('dropdowns').style.display = 'none';
            document.getElementById('mapPage').style.display = 'block';
        }
    };
 }());
