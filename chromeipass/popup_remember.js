var _tab;
//var global = chrome.extension.getBackgroundPage();

function _initialize(tab) {
	_tab = tab;

	if(_tab.credentials.list.length == 0) {
		$("#btn-update").attr("disabled", true);
	}

	$("#btn-new").click(function(e) {
		//global.console.log(_tab.credentials);
		chrome.extension.sendRequest({
			action: 'add_credentials',
			args: [_tab.credentials.username, _tab.credentials.password, _tab.credentials.url]
		}, _verifyResult);
	});

	$("#btn-update").click(function(e) {
		e.preventDefault();

		// only one entry which could be updated
		if(_tab.credentials.list.length == 1) {
			//global.console.log(_tab.credentials.list[0]);
			chrome.extension.sendRequest({
				action: 'update_credentials',
				args: [_tab.credentials.list[0].Uuid, _tab.credentials.username, _tab.credentials.password, _tab.credentials.url]
			}, _verifyResult);
		}
		else {
			$(".credentials:first .username-new:first em:first").text(_tab.credentials.username);
			$(".credentials:first .username-exists:first em:first").text(_tab.credentials.username);

			if(_tab.credentials.usernameExists) {
				$(".credentials:first .username-new:first").hide();
				$(".credentials:first .username-exists:first").show();
			}
			else {
				$(".credentials:first .username-new:first").show();
				$(".credentials:first .username-exists:first").hide();
			}

			for(var i = 0; i < _tab.credentials.list.length; i++) {
				var $a = $("<a>")
					.attr("href", "#")
					.text(_tab.credentials.list[i].Login + " (" + _tab.credentials.list[i].Name + ")")
					.data("entryId", i)
					.click(function(e) {
						e.preventDefault();
						//global.console.log(_tab.credentials.list[$(this).data("entryId")]);
						chrome.extension.sendRequest({
							action: 'update_credentials',
							args: [_tab.credentials.list[$(this).data("entryId")].Uuid, _tab.credentials.username, _tab.credentials.password, _tab.credentials.url]
						}, _verifyResult);
					});

				if(_tab.credentials.usernameExists && _tab.credentials.username == _tab.credentials.list[i].Login) {
					$a.css("font-weight", "bold");
				}

				var $li = $("<li>").append($a);
				$("ul#list").append($li);
			}

			$(".credentials").show();
		}
	});

	$("#btn-dismiss").click(function(e) {
		e.preventDefault();
		_close();
	});
}

function _verifyResult(code) {
	//global.console.log(code);
	if(code == "success") {
		_close();
	}
}

function _close() {
	chrome.extension.sendRequest({
		action: 'remove_credentials_from_tab_information',
		args: []
	});

	chrome.extension.sendRequest({
		action: 'pop_stack',
		args: []
	});

	close();
}

$(function() {
	chrome.extension.sendRequest({
		action: 'add_page_action',
		args: ["keepass_inverse_red_background.png", "popup_remember.html", 10, true]
	});

	chrome.extension.sendRequest({
		action: 'get_tab_information',
		args: []
	}, _initialize);
});