var keepass = keepass || {};

keepass.associated = {"value": false, "hash": null};
keepass.isDatabaseClosed = false;
keepass.isKeePassHttpAvailable = false;
keepass.isEncryptionKeyUnrecognized = false;
keepass.currentKeePassHttp = {"version": 0, "versionParsed": 0};
keepass.latestKeePassHttp = (typeof(localStorage.latestKeePassHttp) == 'undefined') ? {"version": 0, "versionParsed": 0, "lastChecked": null} : JSON.parse(localStorage.latestKeePassHttp);
keepass.keySize = 8; // wtf? stupid cryptoHelpers
keepass.pluginUrl = "http://localhost:19455/";
keepass.cacheTimeout = 30 * 1000; // milliseconds
keepass.databaseHash = null; //0 = keepasshttp is too old and does not return a hash value
keepass.keyRing = (typeof(localStorage.keyRing) == 'undefined') ? {} : JSON.parse(localStorage.keyRing);
keepass.keyId = "chromeipass-cryptokey-name";
keepass.keyBody = "chromeipass-key";
keepass.to_s = cryptoHelpers.convertByteArrayToString;
keepass.to_b = cryptoHelpers.convertStringToByteArray;


keepass.addCredentials = function(callback, tab, username, password, url) {
	keepass.updateCredentials(callback, tab, null, username, password, url);
}

keepass.updateCredentials = function(callback, tab, entryId, username, password, url) {
	// unset error message
	page.tabs[tab.id].errorMessage = null;

	// is browser associated to keepass?
	if(!keepass.testAssociation(tab)) {
		page.eventPopup(null, tab);
		callback("error");
		return;
	}

	// build request
	var request = {
		RequestType: "set-login"
	};
	var verifier = keepass.setVerifier(request);
	var id = verifier[0];
	var key = verifier[1];
	var iv = request.Nonce;


	request.Login = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(username),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			keepass.b64d(iv)
		)
	);

	request.Password = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(password),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			keepass.b64d(iv)
		)
	);

	if(entryId) {
		request.Uuid = keepass.b64e(
			slowAES.encrypt(
				keepass.to_b(entryId),
				slowAES.modeOfOperation.CBC,
				keepass.b64d(key),
				keepass.b64d(iv)
			)
		);
	}

	request.Url = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(url),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			keepass.b64d(iv)
		)
	);

	request.SubmitUrl = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(url),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			keepass.b64d(iv)
		)
	);

	// send request
	var result = keepass.send(request);
	var status = result[0];
	var response = result[1];

	// verify response
	var code = "error";
	if(keepass.checkStatus(status, tab)) {
		var r = JSON.parse(response);
		if (keepass.verifyResponse(r, key, id)) {
			code = "success";
		}
		else {
			code = "error";
		}
	}

	callback(code);
}

keepass.retrieveCredentials = function (callback, tab, url, submiturl, forceCallback) {
	// unset error message
	page.tabs[tab.id].errorMessage = null;

	console.log("url + submiturl: [" + url + "] => [" + submiturl + "]");

	// is browser associated to keepass?
	if(!keepass.testAssociation(tab)) {
		page.eventPopup(null, tab);
		if(forceCallback) {
			callback([]);
		}
		return;
	}

	// build request
	var request = {
		RequestType: "get-logins",
		SortSelection: "true"
	};
	var verifier = keepass.setVerifier(request);
	var id = verifier[0];
	var key = verifier[1];
	var iv = request.Nonce;
	request.Url = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(url),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			keepass.b64d(iv)
		)
	);

	if(submiturl) {
		request.SubmitUrl = keepass.b64e(
			slowAES.encrypt(
				keepass.to_b(submiturl),
				slowAES.modeOfOperation.CBC,
				keepass.b64d(key),
				keepass.b64d(iv)
			)
		);
	}

	// send request
	var result = keepass.send(request);
	var status = result[0];
	var response = result[1];
	var entries = [];

	// verify response
	if(keepass.checkStatus(status, tab)) {
		var r = JSON.parse(response);

		if(r.Version) {
			keepass.currentKeePassHttp = {
				"version": r.Version,
				"versionParsed": parseInt(r.Version.replace(/\./g,""))
			};
		}

		if (keepass.verifyResponse(r, key, id)) {
			var rIv = r.Nonce;
			for (var i = 0; i < r.Entries.length; i++) {
				keepass.decryptEntry(r.Entries[i], key, rIv);
			}
			entries = r.Entries;
			keepass.updateLastUsed(keepass.databaseHash);
			if(entries.length == 0) {
				//questionmark-icon is not triggered, so we have to trigger for the normal symbol
				page.eventPopup(null, tab);
			}
		}
		else {
			console.log("RetrieveCredentials for " + url + " rejected");
		}
	}
	else {
		page.eventPopup(null, tab);
	}

	callback(entries);
}

keepass.associate = function(callback, tab) {
	if(keepass.isAssociated()) {
		return;
	}

	keepass.getDatabaseHash(tab);

	if(keepass.isDatabaseClosed || !keepass.isKeePassHttpAvailable) {
		return;
	}

	page.tabs[tab.id].errorMessage = null;

	var rawKey = cryptoHelpers.generateSharedKey(keepass.keySize * 2);
	var key = keepass.b64e(rawKey);

	var request = {
		RequestType: "associate",
		Key: key
	};

	keepass.setVerifier(request, key);

	var result = keepass.send(request);

	if(keepass.checkStatus(result[0], tab)) {
		var r = JSON.parse(result[1]);

		if(r.Version) {
			keepass.currentKeePassHttp = {
				"version": r.Version,
				"versionParsed": parseInt(r.Version.replace(/\./g,""))
			};
		}

		var id = r.Id;
		if(!keepass.verifyResponse(r, key)) {
			page.tabs[tab.id].errorMessage = "KeePass association failed, try again.";
		}
		else {
			keepass.setCryptoKey(id, key);
			keepass.associated.value = true;
			keepass.associated.hash = r.Hash || 0;
		}

		//chrome.tabs.getSelected(null, function(tab) {
		//	page.showPageAction(callback, tab);
		//});
		page.showPageAction(callback, tab);
	}
}

keepass.isConfigured = function() {
	if(typeof(keepass.databaseHash) == "undefined") {
		keepass.getDatabaseHash();
	}
	return (keepass.databaseHash in keepass.keyRing);
}

keepass.isAssociated = function() {
	return (keepass.associated.value && keepass.associated.hash && keepass.associated.hash == keepass.databaseHash);
}

keepass.send = function(request) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", keepass.pluginUrl, false);
	xhr.setRequestHeader("Content-Type", "application/json");
	try {
		var r = JSON.stringify(request);
		//console.log("Request: " + r);
		xhr.send(r);
	}
	catch (e) {
		console.log("KeePassHttp: " + e);
	}
	//console.log("Response: " + xhr.status + " => " + xhr.responseText);
	return [xhr.status, xhr.responseText];
}

keepass.checkStatus = function (status, tab) {
	var success = (status >= 200 && status <= 299);
	keepass.isDatabaseClosed = false;
	keepass.isKeePassHttpAvailable = true;
	if(tab) {
		delete page.tabs[tab.id].errorMessage;
	}
	if (!success) {
		keepass.associated.value = false;
		keepass.associated.hash = null;
		if(tab) {
			page.tabs[tab.id].errorMessage = "Unknown error: " + status;
		}
		console.log("Error: "+ status);
		if (status == 503) {
			keepass.isDatabaseClosed = true;
			console.log("KeePass database is not opened");
			if(tab) {
				page.tabs[tab.id].errorMessage = "KeePass database is not opened.";
			}
		}
		else if (status == 0) {
			keepass.isKeePassHttpAvailable = false;
			console.log("Could not connect to keepass");
			if(tab) {
				page.tabs[tab.id].errorMessage = "Is KeePassHttp installed and is KeePass running?";
			}
		}
	}
	return success;
}

keepass.convertKeyToKeyRing = function() {
	if(keepass.keyId in localStorage && keepass.keyBody in localStorage) {
		var hash = keepass.getDatabaseHash(tab);
		keepass.saveKey(hash, localStorage[keepass.keyId], localStorage[keepass.keyBody]);
		delete localStorage[keepass.keyId];
		delete localStorage[keepass.keyBody];
	}
}

keepass.saveKey = function(hash, id, key) {
	if(!(hash in keepass.keyRing)) {
		keepass.keyRing[hash] = {
			"id": id,
			"key": key,
			"icon": "purple",
			"created": new Date(),
			"last-used": new Date()
		}
	}
	else {
		keepass.keyRing[hash].id = id;
		keepass.keyRing[hash].key = key;
	}
	localStorage.keyRing = JSON.stringify(keepass.keyRing);
}

keepass.updateLastUsed = function(hash) {
	if((hash in keepass.keyRing)) {
		keepass.keyRing[hash].lastUsed = new Date();
		localStorage.keyRing = JSON.stringify(keepass.keyRing);
	}
}

keepass.deleteKey = function(hash) {
	delete keepass.keyRing[hash];
	localStorage.keyRing = JSON.stringify(keepass.keyRing);
}

keepass.getIconColor = function() {
	return ((keepass.databaseHash in keepass.keyRing) && keepass.keyRing[keepass.databaseHash].icon) ? keepass.keyRing[keepass.databaseHash].icon : "purple";
}

keepass.keePassHttpUpdateAvailable = function() {
	if(page.settings.checkUpdateKeePassHttp && page.settings.checkUpdateKeePassHttp > 0) {
		var lastChecked = (keepass.latestKeePassHttp.lastChecked) ? new Date(keepass.latestKeePassHttp.lastChecked) : 0;
		var daysSinceLastCheck = Math.floor(((new Date()).getTime()-lastChecked.getTime())/86400000);
		if(daysSinceLastCheck >= page.settings.checkUpdateKeePassHttp) {
			keepass.checkForNewKeePassHttpVersion();
		}
	}
	return (keepass.currentKeePassHttp.versionParsed > 0 && keepass.currentKeePassHttp.versioParsed < keepass.latestKeePassHttp.versionParsed);
}

keepass.checkForNewKeePassHttpVersion = function() {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "https://raw.github.com/lspcity/keepasshttp/master/update-version.txt", false);
	xhr.setRequestHeader("Content-Type", "application/json");
	try {
		xhr.send();
		var $version = xhr.responseText;
		if($version.substring(0, 1) == ":") {
			$version = $version.substring(xhr.responseText.indexOf("KeePassHttp") + 12);
			$version = $version.substring(0, $version.indexOf(":") - 1);
			keepass.latestKeePassHttp.version = $version;
			keepass.latestKeePassHttp.versionParsed = parseInt($version.replace(/\./g,""));
		}
		else {
			$version = -1;
		}
	}
	catch (e) {
		console.log("Error: " + e);
	}

	if($version != -1) {
		keepass.latestKeePassHttp.lastChecked = new Date();
		localStorage.latestKeePassHttp = JSON.stringify(keepass.latestKeePassHttp);
	}
}

keepass.testAssociation = function (tab) {
	if(keepass.isAssociated()) {
		return true;
	}

	keepass.getDatabaseHash(tab);

	if(keepass.isDatabaseClosed || !keepass.isKeePassHttpAvailable) {
		return false;
	}

	var request = {
		"RequestType": "test-associate"
	};
	var verifier = keepass.setVerifier(request);

	if(!verifier) {
		keepass.associated.value = false;
		keepass.associated.hash = null;
		return false;
	}

	var result = keepass.send(request);
	var status = result[0];
	var response = result[1];

	if(keepass.checkStatus(status, tab)) {
		var r = JSON.parse(response);
		var id = verifier[0];
		var key = verifier[1];

		if(r.Version) {
			keepass.currentKeePassHttp = {
				"version": r.Version,
				"versionParsed": parseInt(r.Version.replace(/\./g,""))
			};
		}

	keepass.isEncryptionKeyUnrecognized = false;
		if(!keepass.verifyResponse(r, key, id)) {
			var hash = r.Hash || 0;
			keepass.deleteKey(hash);
			keepass.isEncryptionKeyUnrecognized = true;
			console.log("Encryption key is not recognized!");
			page.tabs[tab.id].errorMessage = "Encryption key is not recognized.";
			keepass.associated.value = false;
			keepass.associated.hash = null;
		}
		else if(!keepass.isAssociated()) {
			console.log("Association was not successful");
			page.tabs[tab.id].errorMessage = "Association was not successful.";
		}
	}

	return keepass.isAssociated();
}

keepass.getDatabaseHash = function (tab) {
	var request = {
		"RequestType": "test-associate"
	};

	var result = keepass.send(request);
	if(keepass.checkStatus(result[0], tab)) {
		var response = JSON.parse(result[1]);
		keepass.databaseHash = response.Hash || 0;
	}
	else {
		keepass.databaseHash = 0;
	}

	return keepass.databaseHash;
}

keepass.setVerifier = function(request, inputKey) {
	var key = inputKey || null;
	var id = null;

	if(!key) {
		var info = keepass.getCryptoKey();
		if (info == null) {
			return null;
		}
		id = info[0];
		key = info[1];
	}

	if(id) {
		request.Id = id;
	}

	var iv = cryptoHelpers.generateSharedKey(keepass.keySize);
	request.Nonce = keepass.b64e(iv);

	//var decodedKey = keepass.b64d(key);
	request.Verifier = keepass.b64e(
		slowAES.encrypt(
			keepass.to_b(request.Nonce),
			slowAES.modeOfOperation.CBC,
			keepass.b64d(key),
			iv
		)
	);

	return [id, key];
}

keepass.verifyResponse = function(response, key, id) {
	keepass.associated.value = response.Success;
	if (!response.Success) {
		keepass.associated.hash = null;
		return false;
	}

	keepass.associated.hash = keepass.databaseHash;

	var iv = response.Nonce;
	var crypted = response.Verifier;
	var value = slowAES.decrypt(
		keepass.b64d(crypted),
		slowAES.modeOfOperation.CBC,
		keepass.b64d(key),
		keepass.b64d(iv)
	);

	value = keepass.to_s(value);

	keepass.associated.value = (value == iv);

	if(id) {
		keepass.associated.value = (keepass.associated.value && id == response.Id);
	}

	keepass.associated.hash = (keepass.associated.value) ? keepass.databaseHash : null;

	return keepass.isAssociated();

}

keepass.b64e = function(d) {
	return btoa(keepass.to_s(d));
}

keepass.b64d = function(d) {
	return keepass.to_b(atob(d));
}

keepass.getCryptoKey = function() {
	if(!(keepass.databaseHash in keepass.keyRing)) {
		return null;
	}

	var id = keepass.keyRing[keepass.databaseHash].id;
	var key = null;

	if(id) {
		key = keepass.keyRing[keepass.databaseHash].key;
	}

	return key ? [id, key] : null;
}

keepass.setCryptoKey = function(id, key) {
	keepass.saveKey(keepass.databaseHash, id, key);
}

keepass.decryptEntry = function (e, key, iv) {
	function internalDecrypt(input) {
		return keepass.to_s(
			slowAES.decrypt(
				keepass.b64d(input),
				slowAES.modeOfOperation.CBC,
				keepass.b64d(key),
				keepass.b64d(iv)
			)
		);
	}

	e.Login = UTF8.decode(internalDecrypt(e.Login));
	e.Uuid = internalDecrypt(e.Uuid);
	e.Name = UTF8.decode(internalDecrypt(e.Name));
	e.Password = UTF8.decode(internalDecrypt(e.Password));
}