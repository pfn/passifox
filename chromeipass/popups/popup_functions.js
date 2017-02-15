var $ = cIPJQ.noConflict(true);
var _settings = typeof(localStorage.settings)=='undefined' ? {} : JSON.parse(localStorage.settings);
//var global = browser.runtime.getBackgroundPage();

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
		browser.tabs.create({
			url: "/options/options.html"
		}).then(close);
	});

	$("#settings #btn-choose-credential-fields").click(function() {
		var global = browser.runtime.getBackgroundPage();
		browser.tabs.sendMessage(global.page.currentTabId, {
			action: "choose_credential_fields"
		});
		close();
	});
}


$(function() {
	initSettings();

	browser.runtime.sendMessage({
		action: "update_available_keepasshttp"
	}).then(updateAvailableResponse);
});
