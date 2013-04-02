var page = {};

// special information for every tab
page.tabs = {};

page.currentTabId = -1;
page.settings = (typeof(localStorage.settings) == 'undefined') ? {} : JSON.parse(localStorage.settings);
page.blockedTabs = {};

page.initSettings = function() {
	event.onLoadSettings();
	if(!("checkUpdateKeePassHttp" in page.settings)) {
		page.settings.checkUpdateKeePassHttp = 3;
	}
	if(!("autoCompleteUsernames" in page.settings)) {
		page.settings.autoCompleteUsernames = 1;
	}
	if(!("autoFillAndSend" in page.settings)) {
		page.settings.autoFillAndSend = 1;
	}
	localStorage.settings = JSON.stringify(page.settings);
}

page.initOpenedTabs = function() {
	chrome.tabs.query({}, function(tabs) {
		for(var i = 0; i < tabs.length; i++) {
			page.createTabEntry(tabs[i].id);
		}
	});
}

page.isValidProtocol = function(url) {
	var protocol = url.substring(0, url.indexOf(":"));
	protocol = protocol.toLowerCase();
	return !(url.indexOf(".") == -1 || (protocol != "http" && protocol != "https" && protocol != "ftp" && protocol != "sftp"));
}

page.switchTab = function(callback, tab) {
	browserAction.showDefault(null, tab);

	chrome.tabs.sendMessage(tab.id, {action: "activated_tab"});
}

page.clearCredentials = function(tabId) {
	if(!page.tabs[tabId] || page.tabs[tabId].loginList.length == 0) {
		return;
	}

	page.tabs[tabId].loginList = [];
	page.tabs[tabId].credentials = {};
	delete page.tabs[tabId].credentials;

	chrome.tabs.sendMessage(tabId, {
		action: "clear_credentials"
	});
}

page.createTabEntry = function(tabId) {
	//console.log("page.createTabEntry("+tabId+")");
	page.tabs[tabId] = {
		"stack": [],
		"errorMessage": null,
		"loginList": {}
	};
}

page.removePageInformationFromNotExistingTabs = function() {
	var rand = Math.floor(Math.random()*1001);
	if(rand == 28) {
		chrome.tabs.query({}, function(tabs) {
			var $tabIds = {};
			var $infoIds = Object.keys(page.tabs);

			for(var i = 0; i < tabs.length; i++) {
				$tabIds[tabs[i].id] = true;
			}

			for(var i = 0; i < $infoIds.length; i++) {
				if(!($infoIds[i] in $tabIds)) {
					delete page.tabs[$infoIds[i]];
				}
			}
		});
	}
};