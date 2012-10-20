var b = document.getElementById("connect-button");
b.addEventListener("click", function() {
	chrome.extension.sendRequest({ action: "associate" });
	close();
}, false);

var b = document.getElementById("reconnect-button");
b.addEventListener("click", function() {
	chrome.extension.sendRequest({ action: "associate" });
	close();
}, false);

var b = document.getElementById("clear-button");
b.addEventListener("click", function() {
	last_response.error = null;
	status_response(last_response);
}, false);

function $(id) {
	return document.getElementById(id);
}
var last_response = null;
function status_response(response) {
	last_response = response;
	var error = response.error;
	var configured = response.configured;
	var keyname = response.keyname;
	var associated = response.associated;
	$('initial-state').style.display = "none";
	$('error-encountered').style.display = "none";
	$('need-reconfigure').style.display = "none";
	$('not-configured').style.display = "none";
	$('configured-and-associated').style.display = "none";
	$('configured-not-associated').style.display = "none";
	if (error && !configured) {
		$('need-reconfigure').style.display = "block";
		$('need-reconfigure-message').textContent = error;
	} else if (error) {
		$('error-encountered').style.display = "block";
		$('error-message').textContent = error;
	} else if (!configured) {
		$('not-configured').style.display = "block";
	} else if (keyname && !associated) {
		$('unassociated-keyname').textContent = keyname;
		$('configured-not-associated').style.display = "block";
	} else if (keyname && associated) {
		$('associated-keyname').textContent = keyname;
		$('configured-and-associated').style.display = "block";
	}
}
chrome.extension.sendRequest({ action: "get_status" }, status_response);
