var event = {};


event.onMessage = function(request, sender, callback) {
	if (request.action in event.messageHandlers) {
		//console.log("onMessage(" + request.action + ") for #" + sender.tab.id);

		if(!sender.hasOwnProperty('tab') || sender.tab.id < 1) {
			sender.tab = {};
			sender.tab.id = page.currentTabId;
		}

		event.invoke(event.messageHandlers[request.action], callback, sender.tab.id, request.args);

		// onMessage closes channel for callback automatically
		// if this method does not return true
		if(callback) {
			return true;
		}
	}
}

/**
 * Get interesting information about the given tab.
 * Function adapted from AdBlock-Plus.
 *
 * @param {function} handler to call after invoke
 * @param {function} callback to call after handler or null
 * @param {integer} senderTabId
 * @param {array} args
 * @param {bool} secondTime
 * @returns null (asynchronous)
 */
event.invoke = function(handler, callback, senderTabId, args, secondTime) {
	if(senderTabId < 1) {
		return;
	}

	if(!page.tabs[senderTabId]) {
		page.createTabEntry(senderTabId);
	}

	// remove information from no longer existing tabs
	page.removePageInformationFromNotExistingTabs();

	browser.tabs.get(senderTabId).then(function(tab) {
		if(!tab) {
			return;
		}

		if (!tab.url) {
			// Issue 6877: tab URL is not set directly after you opened a window
			// using window.open()
			if (!secondTime) {
				window.setTimeout(function() {
					event.invoke(handler, callback, senderTabId, args, true);
				}, 250);
			}
			return;
		}

		if(!page.tabs[tab.id]) {
			page.createTabEntry(tab.id);
		}

		args = args || [];

		args.unshift(tab);
		args.unshift(callback);

		if(handler) {
			handler.apply(this, args);
		}
		else {
			console.log("undefined handler for tab " + tab.id);
		}
	});
}

event.onShowAlert = function(callback, tab, message) {
	if( page.settings.supressAlerts ){ console.log(message); }
	else { browser.tabs.executeScript({code: 'alert(\''+message+'\')'}); }
}

event.onLoadSettings = function(callback, tab) {
	browser.storage.local.get({'settings': {}}).then((item) => {
		callback(item.settings);
	}, (err) => {
		console.log('error loading settings: ' + err);
	});
}

event.onLoadKeyRing = function(callback, tab) {
	browser.storage.local.get({'keyRing': {}}).then(function(item) {
		keepass.keyRing = item.keyRing;
		if(keepass.isAssociated() && !keepass.keyRing[keepass.associated.hash]) {
			keepass.associated = {
				"value": false,
				"hash": null
			};
		}
		callback(item.keyRing);
	}, (err) => {
		console.log('error loading keyRing: ' + err);
	});
}

event.onSaveSettings = function(callback, tab, settings) {
	browser.storage.local.set({'settings': settings}).then(function() {
		event.onLoadSettings();
	});
}

event.onGetStatus = function(callback, tab) {
	keepass.testAssociation(tab);

	var configured = keepass.isConfigured();
	var keyId = null;
	if (configured) {
		keyId = keepass.keyRing[keepass.databaseHash].id;
	}

	browserAction.showDefault(null, tab);

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

event.onPopStack = function(callback, tab) {
	browserAction.stackPop(tab.id);
	browserAction.show(null, tab);
}

event.onGetTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	callback(page.tabs[id]);
}

event.onGetConnectedDatabase = function(callback, tab) {
	callback({
		"count": Object.keys(keepass.keyRing).length,
		"identifier": (keepass.keyRing[keepass.associated.hash]) ? keepass.keyRing[keepass.associated.hash].id : null
	});
}

event.onGetKeePassHttpVersions = function(callback, tab) {
	if(keepass.currentKeePassHttp.version == 0) {
		keepass.getDatabaseHash(tab);
	}
	callback({"current": keepass.currentKeePassHttp.version, "latest": keepass.latestKeePassHttp.version});
}

event.onCheckUpdateKeePassHttp = function(callback, tab) {
	keepass.checkForNewKeePassHttpVersion();
	callback({"current": keepass.currentKeePassHttp.version, "latest": keepass.latestKeePassHttp.version});
}

event.onUpdateAvailableKeePassHttp = function(callback, tab) {
	callback(keepass.keePassHttpUpdateAvailable());
}

event.onRemoveCredentialsFromTabInformation = function(callback, tab) {
	var id = tab.id || page.currentTabId;

	page.clearCredentials(id);
}

event.onSetRememberPopup = function(callback, tab, username, password, url, usernameExists, credentialsList) {
	browserAction.setRememberPopup(tab.id, username, password, url, usernameExists, credentialsList);
}

event.onLoginPopup = function(callback, tab, logins) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_login.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = logins;

	browserAction.show(null, tab);
}

event.onHTTPAuthPopup = function(callback, tab, data) {
	var stackData = {
		level: 1,
		iconType: "questionmark",
		popup: "popup_httpauth.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	page.tabs[tab.id].loginList = data;

	browserAction.show(null, tab);
}

event.onMultipleFieldsPopup = function(callback, tab) {
	var stackData = {
		level: 1,
		iconType: "normal",
		popup: "popup_multiple-fields.html"
	}
	browserAction.stackUnshift(stackData, tab.id);

	browserAction.show(null, tab);
}


// all methods named in this object have to be declared BEFORE this!
event.messageHandlers = {
	'add_credentials': keepass.addCredentials,
	'alert': event.onShowAlert,
	'associate': keepass.associate,
	'check_update_keepasshttp': event.onCheckUpdateKeePassHttp,
	'get_connected_database': event.onGetConnectedDatabase,
	'get_keepasshttp_versions': event.onGetKeePassHttpVersions,
	'get_status': event.onGetStatus,
	'get_tab_information': event.onGetTabInformation,
	'load_keyring': event.onLoadKeyRing,
	'load_settings': event.onLoadSettings,
	'pop_stack': event.onPopStack,
	'popup_login': event.onLoginPopup,
	'popup_multiple-fields': event.onMultipleFieldsPopup,
	'remove_credentials_from_tab_information': event.onRemoveCredentialsFromTabInformation,
	'retrieve_credentials': keepass.retrieveCredentials,
	'show_default_browseraction': browserAction.showDefault,
	'update_credentials': keepass.updateCredentials,
	'save_settings': event.onSaveSettings,
	'set_remember_credentials': event.onSetRememberPopup,
	'stack_add': browserAction.stackAdd,
	'update_available_keepasshttp': event.onUpdateAvailableKeePassHttp,
	'generate_password': keepass.generatePassword,
};
