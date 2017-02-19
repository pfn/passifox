$(function() {
	browser.runtime.getBackgroundPage().then(function(global) {
		browser.tabs.query({"active": true, "currentWindow": true}).then(function(tabs) {
			//var data = global.tab_httpauth_list["tab" + tab.id];
			var tab = tabs[0];
			var data = global.page.tabs[tab.id].loginList;
			var ul = document.getElementById("login-list");
			for (var i = 0; i < data.logins.length; i++) {
				var li = document.createElement("li");
				var a = document.createElement("a");
				a.textContent = data.logins[i].Login + " (" + data.logins[i].Name + ")";
				li.appendChild(a);
				$(a).data("url", data.url.replace(/:\/\//g, "://" + data.logins[i].Login + ":" + data.logins[i].Password + "@"));
				$(a).click(function() {
					browser.tabs.update(tab.id, {"url": $(this).data("url")});
					close();
				});
				ul.appendChild(li);
			}
		});
	});
});
