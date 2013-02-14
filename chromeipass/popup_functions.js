var $ = cIPJQ.noConflict(true);
var _settings = typeof(localStorage.settings)=='undefined' ? {} : JSON.parse(localStorage.settings);

function initSettings() {
	$("#settings input[type=checkbox]").each(function() {
		$(this).attr("checked", _settings[$(this).attr("name")]);
	});

	$("#settings input[type=checkbox]").change(function() {
		_settings[$(this).attr("name")] = $(this).is(':checked');
		localStorage.settings = JSON.stringify(_settings);

        chrome.extension.sendRequest({
            action: 'load_settings',
            args: []
        });
	});
}


$(function() {
	initSettings();
});