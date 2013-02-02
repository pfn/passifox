// remove tab-information when it is closed
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	delete page.tabs[tabId];
});

// add tab-information when tab is created
chrome.tabs.onCreated.addListener(function(tab) {
	page.tabs[tab.id] = {
		stack: [],
		errorMessage: null,
		loginList: {}
	};
});

// set the currently active tabId
chrome.tabs.onActivated.addListener(function(activeInfo) {
	page.currentTabId = activeInfo.tabId;
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if(changeInfo.status == "complete") {
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