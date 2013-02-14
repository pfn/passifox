// since version 2.0 the extension is using a keyRing instead of a single key-name-pair
keepass.convertKeyToKeyRing();
page.initSettings();
page.initBlockedTabs();

// remove tab-information when it is closed
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	delete page.tabs[tabId];
	delete page.blockedTabs[tabId];
});

// add tab-information when tab is created
chrome.tabs.onCreated.addListener(function(tab) {
	if(page.checkBlockedTab(tab.url, tab.id)) {
		page.blockedTabs[tab.id] = true;
	}
	else {
		page.tabs[tab.id] = {
			stack: [],
			errorMessage: null,
			loginList: {}
		};
	}
});

// set the currently active tabId
chrome.tabs.onActivated.addListener(function(activeInfo) {
	if(!page.blockedTabs[activeInfo.tabId]) {
		page.currentTabId = activeInfo.tabId;
	}
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if(changeInfo.status == "complete" && !page.blockedTabs[tabId]) {
		page.removeRememberPageAction(tabId);
	}
});



// auto-login user or show logins on HTTPAuth
chrome.webRequest.onAuthRequired.addListener(httpAuth.handleRequest,
	{ urls: ["<all_urls>"] }, ["asyncBlocking"]
);



// interaction between background-script and front-script
chrome.extension.onRequest.addListener(page.onRequest);



// add 2 context menu entries
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



// intervally events
window.setInterval(function() {
	page.updatePageAction();
}, 100);