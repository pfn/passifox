var $ = cIPJQ.noConflict(true);
var _settings = typeof(localStorage.settings)=='undefined' ? {} : JSON.parse(localStorage.settings);
//var global = chrome.extension.getBackgroundPage();

function updateAvailableResponse(available) {
	if(available) {
		$("#update-available").show();
	}
	else {
		$("#update-available").hide();
	}
}

function initSettings() {
	$("#settings #btn-options").click(function() {
		close();
		chrome.tabs.create({
			url: "/options/options.html"
		})
	});

	$("#settings #btn-choose-credential-fields").click(function() {
		var global = chrome.extension.getBackgroundPage();
		chrome.tabs.sendMessage(global.page.currentTabId, {
			action: "choose_credential_fields"
		});
		close();
	});
}

function initBlockState() {
	$('#page-blocked #unblock-button').click(function() {
		var global = chrome.extension.getBackgroundPage();
		chrome.tabs.sendMessage(global.page.currentTabId, {
			action: "unblock_page"
		});
	});

	var global = chrome.extension.getBackgroundPage();
	chrome.tabs.sendMessage(global.page.currentTabId, {
		action: "get_block_status"
	}, function(response) {
		if (response) {
			$('#page-blocked').show();
		}
	});
}


$(function() {
	initSettings();
	initBlockState();

	chrome.extension.sendMessage({
		action: "update_available_keepasshttp"
	}, updateAvailableResponse);
});