var keySize = 8; // wtf?  stupid cryptoHelpers
var associated = false;
var errorMessage = null;
var KEEPASS_HTTP_URL = "http://localhost:19455/";
var CHROMEIPASS_CACHE_TIME = 30 * 1000; // millis

var KEYNAME = "chromeipass-cryptokey-name";
var KEYBODY = "chromeipass-key";

var _cache = {};

var to_s = cryptoHelpers.convertByteArrayToString;
var to_b = cryptoHelpers.convertStringToByteArray;

var _settings = typeof(localStorage.settings)=='undefined' ? {} : JSON.parse(localStorage.settings);

function b64e(d) {
	return btoa(to_s(d));
}
function b64d(d) {
	return to_b(atob(d));
}

function showPageAction(callback, tab) {
	if (!isConfigured() || errorMessage)
		chrome.pageAction.setIcon({
			tabId: tab.id,
			path: "keepass-x.png"
		});
	else
		chrome.pageAction.setIcon({
			tabId: tab.id,
			path: "keepass.png"
		});
	chrome.pageAction.setPopup({
		tabId: tab.id,
		popup: "popup.html"
	});
	chrome.pageAction.show(tab.id);
}
function hidePageAction(callback, tab) {
	chrome.pageAction.hide(tab.id);
}

function showAlert(callback, tab, message) {
	alert(message);
}

function loadSettings(callback, tab) {
	_settings = JSON.parse(localStorage.settings);
}

function getSettings(callback, tab) {
	callback({
		data: JSON.parse(localStorage.settings)
	});
}

var tab_login_list = {};
var tab_httpauth_list = {};
function selectLoginPopup(callback, tab, logins) {
	chrome.pageAction.setIcon({
		tabId: tab.id,
		path: "keepass-q.png"
	});
	chrome.pageAction.setPopup({
		tabId: tab.id,
		popup: "popup_login.html"
	});
	tab_login_list["tab" + tab.id] = logins;
	chrome.pageAction.show(tab.id);
}

function selectHTTPAuthPopup(callback, tab, data) {
	chrome.pageAction.setIcon({
		tabId: tab.id,
		path: "keepass-q.png"
	});
	chrome.pageAction.setPopup({
		tabId: tab.id,
		popup: "popup_httpauth.html"
	});
	tab_httpauth_list["tab" + tab.id] = data;
	chrome.pageAction.show(tab.id);
}

chrome.tabs.onRemoved.addListener(function(tabId, info) {
	delete tab_login_list["tab" + tabId];
	delete tab_httpauth_list["tab" + tabId];
});

function selectFieldPopup(callback, tab) {
	chrome.pageAction.setIcon({
		tabId: tab.id,
		path: "keepass-bang.png"
	});
	chrome.pageAction.setPopup({
		tabId: tab.id,
		popup: "popup_field.html"
	});
	chrome.pageAction.show(tab.id);
}

function getPasswords(callback, tab, url, submiturl, forceCallback) {
	console.log("url + submiturl: [" + url + "] => [" + submiturl + "]");
	//_prune_cache();
	showPageAction(null, tab);
	/*
	var cached = _find_cache_item(url, submiturl);
	if (cached && !force) {
		callback(cached);
		return;
	}
	*/
	if (!_test_associate()) {
		errorMessage = "Association was unsuccessful";
		showPageAction(null, tab);

		if(forceCallback) {
			callback([]);
		}

		return;
	}
	var request = {
		RequestType: "get-logins",
		SortSelection: "true"
	};
	var result = _set_verifier(request);
	var id = result[0];
	var key = result[1];
	var iv = request.Nonce;
	request.Url = b64e(slowAES.encrypt(to_b(url),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv)));
	if (submiturl)
		request.SubmitUrl = b64e(slowAES.encrypt(to_b(submiturl),
			slowAES.modeOfOperation.CBC, b64d(key), b64d(iv)));
	result = _send(request);
	var s = result[0];
	var response = result[1];
	var entries = [];
	if (_success(s)) {
		var r = JSON.parse(response);
		if (_verify_response(r, key, id)) {
			var iv = r.Nonce;
			for (var i = 0; i < r.Entries.length; i++) {
				_decrypt_entry(r.Entries[i], key, iv);
			}
			entries = r.Entries;
		//_cache_item(url, submiturl, entries);
		} else {
			//_cache_item(url, submiturl, []);
			console.log("getPasswords for " + url + " rejected");
		}
	}
	callback(entries);
}
function isConfigured() {
	return KEYNAME in localStorage && KEYBODY in localStorage;
}
function getStatus(callback) {
	var configured = isConfigured();
	var keyname;
	if (configured)
		keyname = localStorage[KEYNAME];
	if (!configured || errorMessage) {
		chrome.tabs.getSelected(null, function(tab) {
			chrome.pageAction.setIcon({
				tabId: tab.id,
				path: "keepass-x.png"
			});
		});
	}
	callback({
		configured: configured,
		keyname: keyname,
		associated: associated,
		error: errorMessage
	});
	errorMessage = null;
}
function associate(callback) {
	if (associated) return;
	var rawkey = cryptoHelpers.generateSharedKey(keySize * 2);
	var key = b64e(rawkey);
	var request = {
		RequestType: "associate",
		Key: key
	};
	_set_verifier(request, key);
	var result = _send(request);
	if (_success(result[0])) {
		var r = JSON.parse(result[1]);
		var id = r.Id;
		if (!_verify_response(r, key)) {
			errorMessage = "KeePass association failed, try again";
		} else {
			_set_crypto_key(id, key);
			associated = true;
		}
		chrome.tabs.getSelected(null, function(tab) {
			showPageAction(callback, tab);
		});
	}
}

var requestHandlers = {
	'show_actions': showPageAction,
	'get_passwords': getPasswords,
	'select_login': selectLoginPopup,
	'select_field': selectFieldPopup,
	'get_status': getStatus,
	'associate': associate,
	'alert': showAlert,
	'load_settings': loadSettings,
	'get_settings': getSettings
};

function onRequest(request, sender, callback) {
	if (request.action in requestHandlers) {
		var args = request.args || [];
		args.unshift(sender.tab);
		args.unshift(callback);
		requestHandlers[request.action].apply(this, args);
	}
}
chrome.extension.onRequest.addListener(onRequest);

///////////////////////////////////////////////////////////////////////////////

var _pendingCallbacks = [];
var _requestId = "";
var _callbackHTTPAuth = null;
var _tabIdForHTTPAuth = 0;
var _urlForHTTPAuth = null;

chrome.webRequest.onAuthRequired.addListener(handleAuthRequest,
	{ urls: ["<all_urls>"] }, ["asyncBlocking"]
);

function processPendingCallbacks(details) {
	_callbackHTTPAuth = _pendingCallbacks.pop();
	_tabIdForHTTPAuth = details.tabId;
	_urlForHTTPAuth = details.url;


	// WORKAROUND: second parameter should be tab, but is an own object with tab-id
	// but in background.js only tab.id is used. To get tabs we could use
	// chrome.tabs.get(tabId, callback) <-- but what should callback be?
	getPasswords(_loginsForHTTPAuth, { "id" : details.tabId }, details.url, details.url, true);
}

function handleAuthRequest(details, callback) {
	if(_requestId == details.requestId) {
		callback({});
	}
	else {
		_requestId = details.requestId;
		_pendingCallbacks.push(callback);
		processPendingCallbacks(details);
	}
}

function _loginsForHTTPAuth (logins) {
	// at least one login found --> use first to login
	if (logins.length > 0) {
		selectHTTPAuthPopup(null, {"id": _tabIdForHTTPAuth}, {"logins": logins, "url": _urlForHTTPAuth});
		//generate popup-list for HTTP Auth usernames + descriptions

		if(_settings.autoFillAndSend) {
			_callbackHTTPAuth({
				authCredentials: {
					username: logins[0].Login,
					password: logins[0].Password
				}
			});
		}
		else {
			_callbackHTTPAuth({});
		}
	}
	// no logins found
	else {
		_callbackHTTPAuth({});
	}
}

///////////////////////////////////////////////////////////////////////////////
function _test_associate() {
	if (associated) {
		return true;
	}
	var request = {
		"RequestType": "test-associate"
	};
	var info = _set_verifier(request);
	if (!info) return false;
	var id = info[0];
	var key = info[1];
	var result = _send(request);
	var s = result[0];
	var response = result[1];
	if (_success(s)) {
		var r = JSON.parse(response);
		if (!_verify_response(r, key, id)) {
			delete localStorage[KEYNAME];
			errorMessage = "Encryption key is unrecognized";
			console.log("Encryption key is unrecognized!");
		}
	}
	return associated;
}
function _set_verifier(request, inkey) {
	var key = null;
	var id = null;
	if (inkey) {
		key = inkey;
	} else {
		var info = _get_crypto_key();
		if (info == null) {
			return null;
		}
		id = info[0];
		key = info[1];
	}
	if (id) request.Id = id;
	var iv = cryptoHelpers.generateSharedKey(keySize);
	request.Nonce = b64e(iv);
	var decodedKey = b64d(key);
	request.Verifier = b64e(slowAES.encrypt(to_b(request.Nonce),
		slowAES.modeOfOperation.CBC, b64d(key), iv));
	return [id, key];
}
function _verify_response(response, key, id) {
	associated = response.Success;
	if (!response.Success) return false;
	var iv = response.Nonce;
	var crypted = response.Verifier;
	var value = slowAES.decrypt(b64d(crypted),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv));
	value = to_s(value);
	associated = value == iv;
	if (id) {
		associated = associated && id == response.Id;
	}
	return associated;

}
function _get_crypto_key() {
	var keyname = localStorage[KEYNAME];
	var key = null;
	if (keyname) {
		key = localStorage[KEYBODY];
	}
	return key ? [keyname, key] : null;
}
function _set_crypto_key(id, key) {
	localStorage[KEYNAME] = id;
	localStorage[KEYBODY] = key;
}

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
function _decrypt_entry(e, key, iv) {
	e.Login = UTF8.decode(to_s(slowAES.decrypt(b64d(e.Login),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv))));
	e.Uuid = to_s(slowAES.decrypt(b64d(e.Uuid),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv)));
	e.Name = UTF8.decode(to_s(slowAES.decrypt(b64d(e.Name),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv))));
	e.Password = UTF8.decode(to_s(slowAES.decrypt(b64d(e.Password),
		slowAES.modeOfOperation.CBC, b64d(key), b64d(iv))));
}
function _success(s) {
	var success = s >= 200 && s <= 299;
	if (!success) {
		errorMessage = "Unknown error: " + s;
		console.log("error: "+ s);
		if (s == 503) {
			console.log("KeePass database is not open");
			errorMessage = "KeePass database is not open";
		} else if (s == 0) {
			console.log("could not connect to keepass");
			errorMessage = "Is KeePassHttp installed and/or " +
		"is KeePass running?";
		}
	}
	return success;
}
function _send(request) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", KEEPASS_HTTP_URL, false);
	xhr.setRequestHeader("Content-Type", "application/json");
	try {
		var r = JSON.stringify(request);
		console.log("Request: " + r);
		xhr.send(r);
	}
	catch (e) {
		console.log("KeePassHttp: " + e);
	}
	console.log("Response: " + xhr.status + " => " + xhr.responseText);
	return [xhr.status, xhr.responseText];
}

chrome.contextMenus.create({
	"title": "Fill User + Pass",
	"contexts": [ "editable" ],
	"onclick": function(info, tab) {
		chrome.tabs.sendRequest(tab.id, {
			action: "fill_user_pass"
		});
	}
});
chrome.contextMenus.create({
	"title": "Fill Pass Only",
	"contexts": [ "editable" ],
	"onclick": function(info, tab) {
		chrome.tabs.sendRequest(tab.id, {
			action: "fill_pass_only"
		});
	}
});