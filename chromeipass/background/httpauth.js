var httpAuth = httpAuth || {};

httpAuth.pendingCallbacks = [];
httpAuth.requestId = "";
httpAuth.tabId = 0;
httpAuth.url = null;
httpAuth.isProxy = false;
httpAuth.proxyUrl = null;
httpAuth.resolve = null;


httpAuth.handleRequest = function (details) {
	return new Promise((resolve, reject) => {
		if(httpAuth.requestId == details.requestId || !page.tabs[details.tabId]) {
			resolve({cancel: true});
		}
		else {
			httpAuth.requestId = details.requestId;
			httpAuth.pendingCallbacks.push(details);
			httpAuth.resolve = resolve;
			httpAuth.processPendingCallbacks(details);
		}
	});
}

httpAuth.processPendingCallbacks = function(details) {
	//httpAuth.callback = httpAuth.pendingCallbacks.pop();
	httpAuth.tabId = details.tabId;
	httpAuth.url = details.url;
	httpAuth.isProxy = details.isProxy;

	if(details.challenger){
		httpAuth.proxyUrl = details.challenger.host;
	}

	// WORKAROUND: second parameter should be tab, but is an own object with tab-id
	// but in background.js only tab.id is used. To get tabs we could use
	// chrome.tabs.get(tabId, callback) <-- but what should callback be?

	var url = (httpAuth.isProxy && httpAuth.proxyUrl) ? httpAuth.proxyUrl : httpAuth.url;

	keepass.retrieveCredentials(httpAuth.loginOrShowCredentials, { "id" : details.tabId }, url, url, true);
}

httpAuth.loginOrShowCredentials = function(logins) {
	// at least one login found --> use first to login
	if (logins.length > 0) {
		var url = (httpAuth.isProxy && httpAuth.proxyUrl) ? httpAuth.proxyUrl : httpAuth.url;
		event.onHTTPAuthPopup(null, {"id": httpAuth.tabId}, {"logins": logins, "url": url});
		//generate popup-list for HTTP Auth usernames + descriptions

		if(page.settings.autoFillAndSend) {
			httpAuth.resolve({
				authCredentials: {
					username: logins[0].Login,
					password: logins[0].Password
				}
			});
		}
		else {
			httpAuth.resolve({cancel:true});
		}
	}
	// no logins found
	else {
		httpAuth.resolve({cancel:true});
	}
}
