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
	if(!("usePasswordGenerator" in page.settings)) {
		page.settings.usePasswordGenerator = 1;
	}
	if(!("autoFillSingleEntry" in page.settings)) {
		page.settings.autoFillSingleEntry = 1;
	}
	if(!("hostname" in page.settings)) {
		page.settings.hostname = "localhost";
	}
	if(!("port" in page.settings)) {
		page.settings.port = "19455";
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

page.clearCredentials = function(tabId, complete) {
	if(!page.tabs[tabId]) {
		return;
	}

	page.tabs[tabId].credentials = {};
	delete page.tabs[tabId].credentials;

    if(complete) {
        page.tabs[tabId].loginList = [];

        chrome.tabs.sendMessage(tabId, {
            action: "clear_credentials"
        });
    }
}

page.createTabEntry = function(tabId) {
	//console.log("page.createTabEntry("+tabId+")");
	page.tabs[tabId] = {
		"stack": [],
		"errorMessage": null,
		"loginList": {},
		"url": null
	};
}

page.updateTabEntry = function(callback, tabId) {
	if(!page.tabs[tabId]) {
		page.createTabEntry(tabId);
	}
	chrome.tabs.get(tabId, function(tab) {
		page.tabs[tabId]["url"] = tab.url;
		callback(page.tabs[tabId]);
	});
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

page.debugConsole = function() {
	if(arguments.length > 1) {
		console.log(page.sprintf(arguments[0], arguments));
	}
	else {
		console.log(arguments[0]);
	}
};

page.sprintf = function(input, args) {
	return input.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? (typeof args[number] == 'object' ? JSON.stringify(args[number]) : args[number])
        : match
      ;
    });
}

page.debugDummy = function() {};

page.debug = page.debugDummy;

page.setDebug = function(bool) {
	if(bool) {
		page.debug = page.debugConsole;
		return "Debug mode enabled";
	}
	else {
		page.debug = page.debugDummy;
		return "Debug mode disabled";
	}
};