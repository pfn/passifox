function status_response(r) {
	$('#initial-state').hide();
	$('#error-encountered').hide();
	$('#need-reconfigure').hide();
	$('#not-configured').hide();
	$('#configured-and-associated').hide();
	$('#configured-not-associated').hide();


	if(!r.keePassHttpAvailable || r.databaseClosed) {
		$('#error-message').html(r.error);
		$('#error-encountered').show();
	}
	else if(!r.configured) {
		$('#not-configured').show();
	}
	else if(r.encryptionKeyUnrecognized) {
		$('#need-reconfigure').show();
		$('#need-reconfigure-message').html(r.error);
	}
	else if(!r.associated) {
		//$('#configured-not-associated').show();
		//$('#unassociated-identifier').html(r.identifier);
		$('#need-reconfigure').show();
		$('#need-reconfigure-message').html(r.error);
	}
	else if(typeof(r.error) != "undefined") {
		$('#error-encountered').show();
		$('#error-message').html(r.error);
	}
	else {
		$('#configured-and-associated').show();
		$('#associated-identifier').html(r.identifier);
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

	$("#reload-status-button").click(function() {
		chrome.extension.sendRequest({
			action: "get_status"
		}, status_response);
	});

	chrome.extension.sendRequest({
		action: "get_status"
	}, status_response);
});