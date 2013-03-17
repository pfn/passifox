var httpAuth = httpAuth || {};

httpAuth.pendingCallbacks = [];
httpAuth.requestId = "";
httpAuth.callback = null;
httpAuth.tabId = 0;
httpAuth.url = null;


httpAuth.handleRequest = function (details, callback) {
	if(httpAuth.requestId == details.requestId || !page.tabs[details.tabId]) {
		callback({});
	}
	else {
		httpAuth.requestId = details.requestId;
		httpAuth.pendingCallbacks.push(callback);
		httpAuth.processPendingCallbacks(details);
	}
}

httpAuth.processPendingCallbacks = function(details) {
	httpAuth.callback = httpAuth.pendingCallbacks.pop();
	httpAuth.tabId = details.tabId;
	httpAuth.url = details.url;


	// WORKAROUND: second parameter should be tab, but is an own object with tab-id
	// but in background.js only tab.id is used. To get tabs we could use
	// chrome.tabs.get(tabId, callback) <-- but what should callback be?
	keepass.retrieveCredentials(httpAuth.loginOrShowCredentials, { "id" : details.tabId }, details.url, details.url, true);
}

httpAuth.loginOrShowCredentials = function(logins) {
	// at least one login found --> use first to login
	if (logins.length > 0) {
		event.onHTTPAuthPopup(null, {"id": httpAuth.tabId}, {"logins": logins, "url": httpAuth.url});
		//generate popup-list for HTTP Auth usernames + descriptions

		if(page.settings.autoFillAndSend) {
			httpAuth.callback({
				authCredentials: {
					username: logins[0].Login,
					password: logins[0].Password
				}
			});
		}
		else {
			httpAuth.callback({});
		}
	}
	// no logins found
	else {
		httpAuth.callback({});
	}
}