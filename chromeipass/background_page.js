var page = page || {};

// special information for every tab
page.tabs = {};

page.currentTabId = 0;
page.settings = (typeof(localStorage.settings) == 'undefined') ? {} : JSON.parse(localStorage.settings);

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
	if(page.tabs[tab.id].stack.length == 0) {
		chrome.pageAction.hide(tab.id);
		return;
	}

	var data = page.tabs[tab.id].stack[page.tabs[tab.id].stack.length - 1];

	chrome.pageAction.setIcon({
		tabId: tab.id,
		path: data.icon
	});

	if(data.popup) {
		chrome.pageAction.setPopup({
			tabId: tab.id,
			popup: data.popup
		});
	}

	chrome.pageAction.show(tab.id);
}

page.hidePageActionLevel = function(callback, tab, level) {
	var newStack = [];
	for(var i = 0; i < page.tabs[tab.id].stack.length; i++) {
		if(page.tabs[tab.id].stack[i].level > level) {
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
			path: data.intervalIcon.icons[data.intervalIcon.index]
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

	if(page.tabs[id]) {
		page.tabs[id].stack.pop();
	}
}

page.setRememberPopup = function(tabId, username, password, url, usernameExists, credentialsList) {
	var id = tabId || page.currentTabId;

	var stackData = {
		level: 10,
		intervalIcon: {
			index: 0,
			counter: 0,
			max: 5,
			icons: ["keepass_inverse_red_background.png", "keepass_inverse_red_lock.png"]
		},
		icon: "keepass_inverse_red_background.png",
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


page.eventAddPageAction = function(callback, tab, icon, popup, level, push) {
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

page.eventGetSettings = function(callback, tab) {
	page.eventLoadSettings();
	callback({ data: page.settings });
}

page.eventGetStatus = function(callback, tab) {
	var configured = keepass.isConfigured();
	var keyId = null;
	if (configured) {
		keyId = localStorage[keepass.keyId];
	}
	if (!configured || page.tabs[tab.id].errorMessage) {
		page.eventPopup(callback, tab);
	}

	console.log(page.tabs[tab.id].errorMessage);

	callback({
		configured: configured,
		keyname: keyId,
		associated: keepass.isAssociated,
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

page.eventRemoveCredentialsFromTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	page.tabs[id].credentials.password = "";
	page.tabs[id].credentials.username = "";
	page.tabs[id].credentials.url = "";
	page.tabs[id].credentials.usernameExists = false;
	page.tabs[id].credentials.list = [];

	delete page.tabs[id].credentials.password;
	delete page.tabs[id].credentials.username;
	delete page.tabs[id].credentials.url;
	delete page.tabs[id].credentials.usernameExists;
	delete page.tabs[id].credentials.list;
}

page.eventSetRememberPopup = function(callback, tab, username, password, url, usernameExists, credentialsList) {
	page.setRememberPopup(tab.id, username, password, url, usernameExists, credentialsList);
}

page.eventLoginPopup = function(callback, tab, logins) {
	var stackData = {
		level: 1,
		icon: "keepass-q.png",
		popup: "popup_login.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = logins;

	page.showPageAction(null, tab);
}

page.eventHTTPAuthPopup = function(callback, tab, data) {
	var stackData = {
		level: 1,
		icon: "keepass-q.png",
		popup: "popup_httpauth.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = data;

	page.showPageAction(null, tab);
}

page.eventMultipleFieldsPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		icon: "keepass.png",
		popup: "popup_multiple-fields.html"
	}
	page.stackUnshift(stackData, tab.id);

	page.showPageAction(null, tab);
}

page.eventPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		icon: "keepass.png",
		popup: "popup.html"
	}
	if(!keepass.isConfigured() || page.tabs[tab.id].errorMessage) {
		stackData.icon = "keepass-x.png";
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
	'get_settings': page.eventGetSettings,
	'set_remember_credentials': page.eventSetRememberPopup,
	'add_page_action': page.eventAddPageAction,
	'pop_stack': page.eventPopStack,
	'get_tab_information': page.eventGetTabInformation,
	'remove_credentials_from_tab_information': page.eventRemoveCredentialsFromTabInformation
};


/*
function _find_cache_item(url, submiturl) {
	var key = url + "!!" + submiturl;
	var item = _cache[key];
	var now = Date.now();
	if (item && (item.ts + CHROMEIPASS_CACHE_TIME) > now) {
		item.ts = now;
		return item.entries;
	}
	return null;
}
function _cache_item(url, submiturl, entries) {
	var key = url + "!!" + submiturl;
	var item = {};
	item.ts = Date.now();
	item.entries = entries;
	_cache[key] = item;
}
function _prune_cache() {
	var now = Date.now();
	for (var i in _cache) {
		var item = _cache[i];
		if ((item.ts + CHROMEIPASS_CACHE_TIME) < now) delete _cache[i];
	}
}
*/