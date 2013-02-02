var last_response = null;

function status_response(response) {
	last_response = response;
	var error = response.error;
	var configured = response.configured;
	var keyname = response.keyname;
	var associated = response.associated;
	$('#initial-state').hide();
	$('#error-encountered').hide();
	$('#need-reconfigure').hide();
	$('#not-configured').hide();
	$('#configured-and-associated').hide();
	$('#configured-not-associated').hide();
	if (error && !configured) {
		$('#need-reconfigure').show();
		$('#need-reconfigure-message').html(error);
	} else if (error) {
		$('#error-encountered').show();
		$('#error-message').html(error);
	} else if (!configured) {
		$('#not-configured').show();
	} else if (keyname && !associated) {
		$('#configured-not-associated').show();
		$('#unassociated-keyname').html(keyname);
	} else if (keyname && associated) {
		$('#configured-and-associated').show();
		$('#associated-keyname').html(keyname);
	}
}

$(function() {
	$("#connect-button").click(function() {
		chrome.extension.sendRequest({
			action: "associate"
		});
		close();
	});

	$("#reconnect-button").click(function() {
		chrome.extension.sendRequest({
			action: "associate"
		});
		close();
	});

	$("#clear-button").click(function() {
		last_response.error = null;
		status_response(last_response);
	});

	chrome.extension.sendRequest({
		action: "get_status"
	}, status_response);
});