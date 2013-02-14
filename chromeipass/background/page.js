var page = page || {};

// special information for every tab
page.tabs = {};

page.currentTabId = 0;
page.settings = (typeof(localStorage.settings) == 'undefined') ? {} : JSON.parse(localStorage.settings);
page.blockedTabs = {};

page.initSettings = function() {
	page.eventLoadSettings();
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
	chrome.windows.getAll({"populate" : true}, function(windows) {
		for(var w = 0; w < windows.length; w++) {
			for(var t = 0; t < windows[w].tabs.length; t++) {
				if(!windows[w].tabs[t].url || page.checkBlockedTab(windows[w].tabs[t].url, windows[w].tabs[t].id)) {
					page.blockedTabs[windows[w].tabs[t].id] = true;
				}
				else {
					page.tabs[windows[w].tabs[t].id] = {
						stack: [],
						errorMessage: null,
						loginList: {}
					};
				}
			}
		}
	});
}

page.checkBlockedTab = function(url, id) {
	return (url.indexOf(".") == -1 || url.substring(0, 18) == "chrome-devtools://"  || url.substring(0, 19) == "chrome-extension://");
}

page.onRequest = function(request, sender, callback) {
	if (request.action in page.requestHandlers) {
		if(sender.tab.id == -1) {
			sender.tab.id = page.currentTabId;
		}

		if(!page.tabs[sender.tab.id]) {
			page.tabs[sender.tab.id] = {
				stack: [],
				errorMessage: null,
				loginList: {}
			};
		}

		var args = request.args || [];
		args.unshift(sender.tab);
		args.unshift(callback);
		page.requestHandlers[request.action].apply(this, args);
	}
}

page.showPageAction = function(callback, tab) {
	chrome.tabs.get(tab.id, function(tab) {
		if(tab) {
			if(!page.tabs[tab.id]) {
				return;
			}

			if(page.tabs[tab.id].stack.length == 0) {
				chrome.pageAction.hide(tab.id);
				return;
			}

			var data = page.tabs[tab.id].stack[page.tabs[tab.id].stack.length - 1];

			chrome.pageAction.setIcon({
				tabId: tab.id,
				path: "/icons/" + page.generateIconName(data.iconType, data.icon)
			});

			if(data.popup) {
				chrome.pageAction.setPopup({
					tabId: tab.id,
					popup: "popups/" + data.popup
				});
			}

			chrome.pageAction.show(tab.id);
		}
	});
}

page.hidePageActionLevel = function(callback, tab, level, type) {
	chrome.tabs.get(tab.id, function(tab) {
		if(tab) {
			if(!page.tabs[tab.id]) {
				return;
			}

			if(!type) {
				type = "<=";
			}

			var newStack = [];
			for(var i = 0; i < page.tabs[tab.id].stack.length; i++) {
				if(
					(type == "<" && page.tabs[tab.id].stack[i].level >= level) ||
					(type == "<=" && page.tabs[tab.id].stack[i].level > level) ||
					(type == "=" && page.tabs[tab.id].stack[i].level == level) ||
					(type == ">" && page.tabs[tab.id].stack[i].level <= level) ||
					(type == ">=" && page.tabs[tab.id].stack[i].level < level)
				) {
					newStack.push(page.tabs[tab.id].stack[i]);
				}
			}

			page.tabs[tab.id].stack = newStack;

			if(newStack.length == 0) {
				chrome.pageAction.hide(tab.id);
			}
			else {
				page.showPageAction(callback, tab);
			}
		}
	});
}

page.updatePageAction = function() {
	if(!page.tabs[page.currentTabId] || page.tabs[page.currentTabId].stack.length == 0) {
		return;
	}

	var data = page.tabs[page.currentTabId].stack[page.tabs[page.currentTabId].stack.length - 1];

	if(data.intervalIcon) {
		data.intervalIcon.counter += 1;
		if(data.intervalIcon.counter < data.intervalIcon.max) {
			return;
		}

		data.intervalIcon.counter = 0;
		data.intervalIcon.index += 1;

		if(data.intervalIcon.index > data.intervalIcon.icons.length - 1) {
			data.intervalIcon.index = 0;
		}

		chrome.pageAction.setIcon({
			tabId: page.currentTabId,
			path: "/icons/" + page.generateIconName(null, data.intervalIcon.icons[data.intervalIcon.index])
		});
	}
}

page.stackRemoveWithLevel = function(tabId, level) {
	for(var i = 0; i < page.tabs[tabId].stack.length; i++) {
		if(page.tabs[tabId].stack[i].level == level) {
			page.tabs[tabId].stack.splice(i, 1);
			break;
		}
	}
}

page.stackPush = function(data, tabId) {
	var id = tabId || page.currentTabId;

	page.stackRemoveWithLevel(tabId, data.level);
	page.tabs[id].stack.push(data);
}

page.stackUnshift = function(data, tabId) {
	var id = tabId || page.currentTabId;

	page.stackRemoveWithLevel(tabId, data.level);
	page.tabs[id].stack.unshift(data);
}

page.stackPop = function(tabId) {
	var id = tabId || page.currentTabId;
}

page.clearCredentials = function(tabId) {
	if(page.tabs[tabId]) {
		page.tabs[tabId].credentials = {};
		delete page.tabs[tabId].credentials;
	}
}

page.removeRememberPageAction = function(tabId) {
	if(!page.tabs[tabId]) {
		return;
	}

	if(page.tabs[tabId].stack.length == 0) {
		if(page.tabs[tabId].credentials) {
			page.clearCredentials(tabId);
		}
		return;
	}

	if(typeof page.tabs[tabId].stack[page.tabs[tabId].stack.length - 1].visibleForPageUpdates != "undefined") {
		if(page.tabs[tabId].stack[page.tabs[tabId].stack.length - 1].visibleForPageUpdates <= 0) {
			page.stackPop(tabId);
			page.showPageAction(null, {id: tabId});
			page.clearCredentials(tabId);
			return;
		}
		page.tabs[tabId].stack[page.tabs[tabId].stack.length - 1].visibleForPageUpdates -= 1;
	}
}

page.setRememberPopup = function(tabId, username, password, url, usernameExists, credentialsList) {
	var id = tabId || page.currentTabId;

	var stackData = {
		visibleForPageUpdates: 2,
		level: 10,
		intervalIcon: {
			index: 0,
			counter: 0,
			max: 5,
			icons: ["icon_remember_red_background_16x16.png", "icon_remember_red_lock_16x16.png"]
		},
		icon: "icon_remember_red_background_16x16.png",
		popup: "popup_remember.html"
	}

	page.stackPush(stackData, id);

	page.tabs[id].credentials = {
		"username": username,
		"password": password,
		"url": url,
		"usernameExists": usernameExists,
		"list": credentialsList
	};
}

page.generateIconName = function(iconType, icon) {
	if(icon) {
		return icon;
	}

	var name = "icon_";
	name += (keepass.keePassHttpUpdateAvailable()) ? "new_" : "";
	name += (!iconType || iconType == "normal") ? "normal_" : iconType + "_";
	name += keepass.getIconColor();
	name += "_16x16.png";

	return name;
}


page.eventAddPageAction = function(callback, tab, icon, popup, level, push, visibleForPageUpdates) {
	var id = tab.id || page.currentTabId;

	if(!level) {
		level = 1;
	}

	var stackData = {
		"level": level,
		"icon": icon
	}

	if(popup) {
		stackData.popup = popup;
	}

	if(visibleForPageUpdates) {
		stackData.visibleForPageUpdates = visibleForPageUpdates;
	}

	if(push) {
		page.stackPush(stackData, id);
	}
	else {
		page.stackUnshift(stackData, id);
	}

	page.showPageAction(null, {"id": id});
}

page.eventShowAlert = function(callback, tab, message) {
	alert(message);
}

page.eventLoadSettings = function(callback, tab) {
	page.settings = (typeof(localStorage.settings) == 'undefined') ? {} : JSON.parse(localStorage.settings);
}

page.eventLoadKeyRing = function(callback, tab) {
	keepass.keyRing = (typeof(localStorage.keyRing) == 'undefined') ? {} : JSON.parse(localStorage.keyRing);
	if(keepass.isAssociated() && !keepass.keyRing[keepass.associated.hash]) {
		keepass.associated = {
			"value": false,
			"hash": null
		};
	}
}

page.eventGetSettings = function(callback, tab) {
	page.eventLoadSettings();
	callback({ data: page.settings });
}

page.eventSaveSettings = function(callback, tab, settings) {
	localStorage.settings = JSON.stringify(settings);
	page.eventLoadSettings();
}

page.eventGetStatus = function(callback, tab) {
	keepass.testAssociation(tab);

	var configured = keepass.isConfigured();
	var keyId = null;
	if (configured) {
		keyId = keepass.keyRing[keepass.databaseHash].id;
	}

	page.eventPopup(null, tab);

	callback({
		identifier: keyId,
		configured: configured,
		databaseClosed: keepass.isDatabaseClosed,
		keePassHttpAvailable: keepass.isKeePassHttpAvailable,
		encryptionKeyUnrecognized: keepass.isEncryptionKeyUnrecognized,
		associated: keepass.isAssociated(),
		error: page.tabs[tab.id].errorMessage
	});
}

page.eventPopStack = function(callback, tab) {
	page.stackPop(tab.id);
	page.showPageAction(callback, tab);
}

page.eventGetTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	callback(page.tabs[id]);
}

page.eventGetConnectedDatabase = function(callback, tab) {
	callback({
		"count": Object.keys(keepass.keyRing).length,
		"identifier": (keepass.keyRing[keepass.associated.hash]) ? keepass.keyRing[keepass.associated.hash].id : null
	});
}

page.eventGetKeePassHttpVersions = function(callback, tab) {
	callback({"current": keepass.currentKeePassHttp.version, "latest": keepass.latestKeePassHttp.version});
}

page.eventCheckUpdateKeePassHttp = function(callback, tab) {
	keepass.checkForNewKeePassHttpVersion();
	callback({"current": keepass.currentKeePassHttp.version, "latest": keepass.latestKeePassHttp.version});
}

page.eventUpdateAvailableKeePassHttp = function(callback, tab) {
	callback(keepass.keePassHttpUpdateAvailable());
}

page.eventRemoveCredentialsFromTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	page.clearCredentials(id);
}

page.eventSetRememberPopup = function(callback, tab, username, password, url, usernameExists, credentialsList) {
	page.setRememberPopup(tab.id, username, password, url, usernameExists, credentialsList);
}

page.eventLoginPopup = function(callback, tab, logins) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_login.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = logins;

	page.showPageAction(null, tab);
}

page.eventHTTPAuthPopup = function(callback, tab, data) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_httpauth.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = data;

	page.showPageAction(null, tab);
}

page.eventMultipleFieldsPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		iconType: "normal",
		popup: "popup_multiple-fields.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.showPageAction(null, tab);
}

page.eventPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		iconType: "normal",
		popup: "popup.html"
	}
	if(!keepass.isConfigured() || keepass.isDatabaseClosed || !keepass.isKeePassHttpAvailable || page.tabs[tab.id].errorMessage) {
		stackData.iconType = "cross";
	}

	page.stackUnshift(stackData, tab.id);

	page.showPageAction(null, tab);
}

// all methods named in this object have to be declared BEFORE this!
page.requestHandlers = {
	'hide_action_level': page.hidePageActionLevel,
	'show_action': page.showPageAction,
	'retrieve_credentials': keepass.retrieveCredentials,
	'add_credentials': keepass.addCredentials,
	'update_credentials': keepass.updateCredentials,
	'popup_login': page.eventLoginPopup,
	'popup_multiple-fields': page.eventMultipleFieldsPopup,
	'get_status': page.eventGetStatus,
	'associate': keepass.associate,
	'alert': page.eventShowAlert,
	'load_settings': page.eventLoadSettings,
	'load_keyring': page.eventLoadKeyRing,
	'get_settings': page.eventGetSettings,
	'save_settings': page.eventSaveSettings,
	'set_remember_credentials': page.eventSetRememberPopup,
	'add_page_action': page.eventAddPageAction,
	'pop_stack': page.eventPopStack,
	'get_tab_information': page.eventGetTabInformation,
	'get_connected_database': page.eventGetConnectedDatabase,
	'get_keepasshttp_versions': page.eventGetKeePassHttpVersions,
	'check_update_keepasshttp': page.eventCheckUpdateKeePassHttp,
	'update_available_keepasshttp': page.eventUpdateAvailableKeePassHttp,
	'remove_credentials_from_tab_information': page.eventRemoveCredentialsFromTabInformation
};