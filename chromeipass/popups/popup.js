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
		chrome.extension.sendMessage({
			action: "associate"
		});
		close();
	});

	$("#reconnect-button").click(function() {
		chrome.extension.sendMessage({
			action: "associate"
		});
		close();
	});

	$("#reload-status-button").click(function() {
		chrome.extension.sendMessage({
			action: "get_status"
		}, status_response);
	});

	$("#redetect-fields-button").click(function() {
		chrome.tabs.query({"active": true, "windowId": chrome.windows.WINDOW_ID_CURRENT}, function(tabs) {
			if (tabs.length === 0)
				return; // For example: only the background devtools or a popup are opened
			var tab = tabs[0];

			chrome.tabs.sendMessage(tab.id, {
				action: "redetect_fields"
			});
			close();
		});
	});

	chrome.extension.sendMessage({
		action: "get_status"
	}, status_response);
});