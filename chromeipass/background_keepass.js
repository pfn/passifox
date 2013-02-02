var keepass = keepass || {};

keepass.isAssociated = null;
keepass.keySize = 8; // wtf? stupid cryptoHelpers
keepass.pluginUrl = "http://localhost:19455/";
keepass.cacheTimeout = 30 * 1000; // milliseconds
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

	page.eventPopup(null, tab);

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
		if (keepass.verifyResponse(r, key, id)) {
			var rIv = r.Nonce;
			for (var i = 0; i < r.Entries.length; i++) {
				keepass.decryptEntry(r.Entries[i], key, rIv);
			}
			entries = r.Entries;
		} else {
			console.log("RetrieveCredentials for " + url + " rejected");
		}
	}

	callback(entries);
}

keepass.associate = function(callback, tab) {
	if(keepass.isAssociated) {
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
		var id = r.Id;
		if(!keepass.verifyResponse(r, key)) {
			page.tabs[tab.id].errorMessage = "KeePass association failed, try again";
		}
		else {
			keepass.setCryptoKey(id, key);
			keepass.isAssociated = true;
		}

		//chrome.tabs.getSelected(null, function(tab) {
		//	page.showPageAction(callback, tab);
		//});
		page.showPageAction(callback, tab);
	}
}

keepass.isConfigured = function() {
	return ((keepass.keyId in localStorage) && (keepass.keyBody in localStorage));
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
	if (!success) {
		page.tabs[tab.id].errorMessage = "Unknown error: " + status;
		console.log("error: "+ status);
		if (status == 503) {
			console.log("KeePass database is not opened");
			page.tabs[tab.id].errorMessage = "KeePass database is not opened";
		}
		else if (status == 0) {
			console.log("could not connect to keepass");
			page.tabs[tab.id].errorMessage = "Is KeePassHttp installed and is KeePass running?";
		}
	}
	return success;
}

keepass.testAssociation = function (tab) {
	if(keepass.isAssociated) {
		return true;
	}

	var request = {
		"RequestType": "test-associate"
	};

	var verifier = keepass.setVerifier(request);
	if(!verifier) {
		keepass.isAssociated = false;
		return false;
	}

	var result = keepass.send(request);
	var status = result[0];
	var response = result[1];

	if(keepass.checkStatus(status, tab)) {
		var r = JSON.parse(response);
		var id = verifier[0];
		var key = verifier[1];

		if(!keepass.verifyResponse(r, key, id)) {
			delete localStorage[keepass.keyId];
			console.log("Encryption key is unrecognized!");
			page.tabs[tab.id].errorMessage = "Encryption key is unrecognized";
			keepass.isAssociated = false;
		}
		else if(!keepass.isAssociated) {
			console.log("Association was not successful");
			page.tabs[tab.id].errorMessage = "Association was not successful";
		}
	}

	return keepass.isAssociated;
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
	keepass.isAssociated = response.Success;
	if (!response.Success) {
		return false;
	}

	var iv = response.Nonce;
	var crypted = response.Verifier;
	var value = slowAES.decrypt(
		keepass.b64d(crypted),
		slowAES.modeOfOperation.CBC,
		keepass.b64d(key),
		keepass.b64d(iv)
	);

	value = keepass.to_s(value);

	keepass.isAssociated = (value == iv);

	if(id) {
		keepass.isAssociated = (keepass.isAssociated && id == response.Id);
	}

	return keepass.isAssociated;

}

keepass.b64e = function(d) {
	return btoa(keepass.to_s(d));
}

keepass.b64d = function(d) {
	return keepass.to_b(atob(d));
}

keepass.getCryptoKey = function() {
	var keyId = localStorage[keepass.keyId];
	var keyBody = null;

	if(keyId) {
		keyBody = localStorage[keepass.keyBody];
	}

	return keyBody ? [keyId, keyBody] : null;
}

keepass.setCryptoKey = function(id, key) {
	localStorage[keepass.keyId] = id;
	localStorage[keepass.keyBody] = key;
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