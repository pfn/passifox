$(function() {
	var global = chrome.extension.getBackgroundPage();

	chrome.tabs.getSelected(null, function(tab) {
		//var logins = global.tab_login_list["tab" + tab.id];
		var logins = global.page.tabs[tab.id].loginList;
		var ul = document.getElementById("login-list");
		for (var i = 0; i < logins.length; i++) {
			var li = document.createElement("li");
			var a = document.createElement("a");
			a.textContent = logins[i];
			li.appendChild(a);
			a.setAttribute("id", "" + i);
			a.addEventListener('click', function(e) {
				var id = e.target.id;
				chrome.tabs.sendRequest(tab.id, {
					id: id
				});
				close();
			});
			ul.appendChild(li);
		}
	});
});