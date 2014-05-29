if(cIPJQ) {
	var $ = cIPJQ.noConflict(true);
}

$(function() {
	options.initMenu();
	options.initGeneralSettings();
	options.initConnectedDatabases();
	options.initSpecifiedCredentialFields();
	options.initBlockedPages();
	options.initAbout();
});


var options = options || {};

options.settings = typeof(localStorage.settings)=='undefined' ? {} : JSON.parse(localStorage.settings);
options.keyRing = typeof(localStorage.keyRing)=='undefined' ? {} : JSON.parse(localStorage.keyRing);

options.initMenu = function() {
	$(".navbar:first ul.nav:first li a").click(function(e) {
		e.preventDefault();
		$(".navbar:first ul.nav:first li").removeClass("active");
		$(this).parent("li").addClass("active");
		$("div.tab").hide();
		$("div.tab#tab-" + $(this).attr("href").substring(1)).fadeIn();
	});

	$("div.tab:first").show();
}

options.initGeneralSettings = function() {
	$("#tab-general-settings input[type=checkbox]").each(function() {
		$(this).attr("checked", options.settings[$(this).attr("name")]);
	});

	$("#tab-general-settings input[type=checkbox]").change(function() {
		options.settings[$(this).attr("name")] = $(this).is(':checked');
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });
	});

	$("#tab-general-settings input[type=radio]").each(function() {
		if($(this).val() == options.settings[$(this).attr("name")]) {
			$(this).attr("checked", options.settings[$(this).attr("name")]);
		}
	});

	$("#tab-general-settings input[type=radio]").change(function() {
		options.settings[$(this).attr("name")] = $(this).val();
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });
	});

	chrome.extension.sendMessage({
		action: "get_keepasshttp_versions"
	}, options.showKeePassHttpVersions);

	$("#tab-general-settings button.checkUpdateKeePassHttp:first").click(function(e) {
		e.preventDefault();
		$(this).attr("disabled", true);
		chrome.extension.sendMessage({
			action: "check_update_keepasshttp"
		}, options.showKeePassHttpVersions);
	});


	$("#showDangerousSettings").click(function() {
		$("#dangerousSettings").show();
		$(this).hide();
	});

	$("#hostname").val(options.settings["hostname"]);
	$("#port").val(options.settings["port"]);

	$("#portButton").click(function() {
		var port = $.trim($("#port").val());
		var portNumber = parseInt(port);
		if(isNaN(port) || portNumber < 1025 || portNumber > 99999) {
			$("#port").closest(".control-group").addClass("error");
			alert("The port number has to be in range 1025 - 99999.\nNothing saved!");
			return;
		}

		options.settings["port"] = portNumber.toString();
		$("#port").closest(".control-group").removeClass("error").addClass("success");
		setTimeout(function() {$("#port").closest(".control-group").removeClass("success")}, 2500);

		localStorage.settings = JSON.stringify(options.settings);

		chrome.extension.sendMessage({
			action: 'load_settings'
		});
	});

	$("#hostnameButton").click(function() {
		var hostname = $("#hostname").val();
		if($.trim(hostname) == "") {
			$("#hostname").closest(".control-group").addClass("error");
			alert("Hostname cannot be empty.\nNothing saved!");
			return;
		}

		options.settings["hostname"] = hostname;
		$("#hostname").closest(".control-group").removeClass("error").addClass("success");
		setTimeout(function() {$("#hostname").closest(".control-group").removeClass("success")}, 2500);

		localStorage.settings = JSON.stringify(options.settings);

		chrome.extension.sendMessage({
			action: 'load_settings'
		});
	});
};

options.showKeePassHttpVersions = function(response) {
	if(response.current <= 0) {
		response.current = "unknown";
	}
	if(response.latest <= 0) {
		response.latest = "unknown";
	}
	$("#tab-general-settings .kphVersion:first em.yourVersion:first").text(response.current);
	$("#tab-general-settings .kphVersion:first em.latestVersion:first").text(response.latest);

	$("#tab-about em.versionKPH").text(response.current);

	$("#tab-general-settings button.checkUpdateKeePassHttp:first").attr("disabled", false);
}

options.initConnectedDatabases = function() {
	$("#dialogDeleteConnectedDatabase").modal({keyboard: true, show: false, backdrop: true});
	$("#tab-connected-databases tr.clone:first button.delete:first").click(function(e) {
		e.preventDefault();
		$("#dialogDeleteConnectedDatabase").data("hash", $(this).closest("tr").data("hash"));
		$("#dialogDeleteConnectedDatabase .modal-body:first span:first").text($(this).closest("tr").children("td:first").text());
		$("#dialogDeleteConnectedDatabase").modal("show");
	});

	$("#dialogDeleteConnectedDatabase .modal-footer:first button.yes:first").click(function(e) {
		$("#dialogDeleteConnectedDatabase").modal("hide");

		var $hash = $("#dialogDeleteConnectedDatabase").data("hash");
		$("#tab-connected-databases #tr-cd-" + $hash).remove();

		delete options.keyRing[$hash];
		localStorage.keyRing = JSON.stringify(options.keyRing);

        chrome.extension.sendMessage({
            action: 'load_keyring'
        });

		if($("#tab-connected-databases table tbody:first tr").length > 2) {
			$("#tab-connected-databases table tbody:first tr.empty:first").hide();
		}
		else {
			$("#tab-connected-databases table tbody:first tr.empty:first").show();
		}
	});

	$("#tab-connected-databases tr.clone:first .dropdown-menu:first").width("230px");

	$("#tab-connected-databases tr.clone:first .color.dropdown .dropdown-menu a").click(function(e) {
		e.preventDefault();
		var $icon = $(this).attr("href").substring(1);
		var $hash = $(this).closest("tr").data("hash");

		$(this).parent().parent().find("a.dropdown-toggle:first").find("img:first").attr("src", "/icons/19x19/icon_normal_" + $icon + "_19x19.png");

		options.keyRing[$hash].icon = $icon;
		localStorage.keyRing = JSON.stringify(options.keyRing);
        chrome.extension.sendMessage({
            action: 'load_keyring'
        });
	});

	var $trClone = $("#tab-connected-databases table tr.clone:first").clone(true);
	$trClone.removeClass("clone");
	for(var hash in options.keyRing) {
		var $tr = $trClone.clone(true);
		$tr.data("hash", hash);
		$tr.attr("id", "tr-cd-" + hash);

		var $icon = options.keyRing[hash].icon || "blue";
		$("a.dropdown-toggle:first img:first", $tr).attr("src", "/icons/19x19/icon_normal_" + $icon + "_19x19.png");

		$tr.children("td:first").text(options.keyRing[hash].id);
		var lastUsed = (options.keyRing[hash].lastUsed) ? new Date(options.keyRing[hash].lastUsed).toLocaleString() : "unknown";
		$tr.children("td:eq(2)").text(lastUsed);
		var date = (options.keyRing[hash].created) ? new Date(options.keyRing[hash].created).toLocaleDateString() : "unknown";
		$tr.children("td:eq(3)").text(date);
		$("#tab-connected-databases table tbody:first").append($tr);
	}

	if($("#tab-connected-databases table tbody:first tr").length > 2) {
		$("#tab-connected-databases table tbody:first tr.empty:first").hide();
	}
	else {
		$("#tab-connected-databases table tbody:first tr.empty:first").show();
	}
}

options.initSpecifiedCredentialFields = function() {
	$("#dialogDeleteSpecifiedCredentialFields").modal({keyboard: true, show: false, backdrop: true});
	$("#tab-specified-fields tr.clone:first button.delete:first").click(function(e) {
		e.preventDefault();
		$("#dialogDeleteSpecifiedCredentialFields").data("url", $(this).closest("tr").data("url"));
		$("#dialogDeleteSpecifiedCredentialFields").data("tr-id", $(this).closest("tr").attr("id"));
		$("#dialogDeleteSpecifiedCredentialFields .modal-body:first strong:first").text($(this).closest("tr").children("td:first").text());
		$("#dialogDeleteSpecifiedCredentialFields").modal("show");
	});

	$("#dialogDeleteSpecifiedCredentialFields .modal-footer:first button.yes:first").click(function(e) {
		$("#dialogDeleteSpecifiedCredentialFields").modal("hide");

		var $url = $("#dialogDeleteSpecifiedCredentialFields").data("url");
		var $trId = $("#dialogDeleteSpecifiedCredentialFields").data("tr-id");
		$("#tab-specified-fields #" + $trId).remove();

		delete options.settings["defined-credential-fields"][$url];
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });

		if($("#tab-specified-fields table tbody:first tr").length > 2) {
			$("#tab-specified-fields table tbody:first tr.empty:first").hide();
		}
		else {
			$("#tab-specified-fields table tbody:first tr.empty:first").show();
		}
	});

	var $trClone = $("#tab-specified-fields table tr.clone:first").clone(true);
	$trClone.removeClass("clone");
	var counter = 1;
	for(var url in options.settings["defined-credential-fields"]) {
		var $tr = $trClone.clone(true);
		$tr.data("url", url);
		$tr.attr("id", "tr-scf" + counter);
		counter += 1;

		$tr.children("td:first").text(url);
		$("#tab-specified-fields table tbody:first").append($tr);
	}

	if($("#tab-specified-fields table tbody:first tr").length > 2) {
		$("#tab-specified-fields table tbody:first tr.empty:first").hide();
	}
	else {
		$("#tab-specified-fields table tbody:first tr.empty:first").show();
	}
}

options.initBlockedPages = function() {
	$("#dialogDeleteBlockedPages").modal({keyboard: true, show: false, backdrop: true});
	
	/* Utility functions for table manipulation and row display. */
	// Add a row and its hidden edit row to the blocked pages table.
	var bp_addRow = function(blockedPage, index) {
		var url = blockedPage["text"];
		var regex = blockedPage["regex"];

		// Add content row.
		var $tr = $trClone.clone(true);
		$tr.data("url", url);
		$tr.data("index", index);
		$tr.attr("id", "tr-bp" + index);
		$tr.children("td:first").text(url);
		// TODO: Add check icon if regex.
		$("#tab-blocked-pages table tbody:first").append($tr);

		// Add edit row.
		var $trEdit = $trEditClone.clone(true);

		// Set tr-specific information 
		$trEdit.data("url", url);
		$trEdit.data("index", index);
		$trEdit.attr("id", "tr-edit-bp" + index);
		$trEdit.children("td:first").children("td.bp-edit:first").textContent = url;
		$("#tab-blocked-pages table tbody:first").append($trEdit);
		$trEdit.hide();
	}

	// Create edit row for addition of new entries.
	var bp_addNewRow = function() {
		// Create new row and append to bottom of table.
		var $trNew = $trEditClone.clone(true);
		// TODO: Set ids of input box and checkbox
		// Set tr-specific information
		$trNew.attr("id", "tr-new-bp");
		$trNew.children("td:first").children(".bp-edit").attr("id")
		$("#tab-blocked-pages table tbody:first").append($trNew);
	}

	// Display placeholder text if there are no entries in the table.
	var bp_placeholder = function() {
		if($("#tab-blocked-pages table tbody:first tr").length > 4) {
			$("#tab-blocked-pages table tbody:first tr.empty:first").hide();
		} else {
			$("#tab-blocked-pages table tbody:first tr.empty:first").show();
		}
	}

	// TODO: Set row delete button action.
	$("#tab-blocked-pages tr.clone:first button.delete:first").click(function(e) {
		e.preventDefault();
		var row = $(this).closest("tr");
		var url = row.data("url");
		var location = options.settings["blocked-pages"]
				.map(function (elt) { elt["text"] })
				.indexOf(url);
		$("#tr-edit-bp" + row.data("index")).remove();
		row.remove();


		options.settings["blocked-pages"].splice(location, 1);
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });

    bp_placeholder();
	});

	// Set row edit button action.
	$("#tab-blocked-pages tr.clone:first button.edit:first").click(function(e) {
		e.preventDefault();
		// Hide original row.
		var row = $(this).closest("tr");
		row.hide();
		// Set edit row values.
		var editRow = $("#tr-edit-bp" + row.data("index"));
		var input = editRow.children("td:first").children("input.bp-edit")[0];
		input.value = row.data("url");
		// TODO: Set regex checkbox.
		// Show edit row.
		editRow.show();
	});

	// Set row save button action.
	$("#tab-blocked-pages tr.cloneedit:first button.save:first").click(function(e) {
		e.preventDefault();
		// Get information.
		var id = $(this).closest("tr").attr("id");
		var newRow = (id == "tr-new-bp");
		var row = $(this).closest("tr");

		var url = row.children("td:first").children("input.bp-edit:first")[0].value;
		var treatAsRegex = true; // TODO: implement.

		// TODO: Check against some validations.
		// Can't be blank
		// Can't match another row

		var data = {
			text: url,
			regex: treatAsRegex
		};

		// Ensure array is present.
		if (!options.settings["blocked-pages"]) {
			options.settings["blocked-pages"] = [];
		}

		if (newRow) {
			console.debug("New row.");
			
			options.settings["blocked-pages"].push(data);

			// Append new row to table with relevant information.
			bp_addRow(data, options.bpRowCounter);
			options.bpRowCounter += 1;

			// Remove old new row and add another to the end of the table.
			row.remove();
			bp_addNewRow();
		} else {
			var originalUrl = row.data("url");
			var location = options.settings["blocked-pages"]
				.map(function (elt) { elt["text"] })
				.indexOf(originalUrl);

			if (location != -1) {
				console.error("Existing entry not found.");
				// TODO: Error message.
			} else {
				options.settings["blocked-pages"][location] = data;
			}

			// Show the old row but update the data to reflect the new values.
			var existingRow = $("#tr-bp" + row.data("index"));
			existingRow.children("td:first").text(data["text"]);
			existingRow.data("url", data["text"]);
			existingRow.show();
			
			// Update edit row.
			row.data("url", data["text"]);
			row.hide();
		}

		// Update settings.
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });

    bp_placeholder();
	});

	// Set row cancel button action.
	$("#tab-blocked-pages tr.cloneedit:first button.cancel:first").click(function(e) {
		e.preventDefault();
		var row = $(this).closest("tr");
		var id = row.attr("id");
		var newRow = (id == "tr-new-bp");

		// Hide edit row regardless.
		row.hide();

		if (!newRow) {
			// Also unhide the existing entry.
			$("#tr-bp" + row.data("index")).show();
		}
	});

	// Set new button action.
	$("#tab-blocked-pages .new-item-holder button.new:first").click(function(e) {
		e.preventDefault();
		$("#tr-new-bp").toggle();
	});

	// Set modal button action.
	$("#dialogDeleteBlockedPages .modal-footer:first button.yes:first").click(function(e) {
		$("#dialogDeleteBlockedPages").modal("hide");

		var $url = $("#dialogDeleteBlockedPages").data("url");
		var $trId = $("#dialogDeleteBlockedPages").data("tr-id");
		$("#tab-blocked-pages #" + $trId).remove();

		delete options.settings["blocked-pages"][$url];
		localStorage.settings = JSON.stringify(options.settings);

        chrome.extension.sendMessage({
            action: 'load_settings'
        });

		if($("#tab-blocked-pages table tbody:first tr").length > 2) {
			$("#tab-blocked-pages table tbody:first tr.empty:first").hide();
		}
		else {
			$("#tab-blocked-pages table tbody:first tr.empty:first").show();
		}
	});

	// Get template rows.
	var $trClone = $("#tab-blocked-pages table tr.clone:first").clone(true);
	$trClone.removeClass("clone");
	var $trEditClone = $("#tab-blocked-pages table tr.cloneedit:first").clone(true);
	$trEditClone.removeClass("cloneedit");

	// Create rows in table.
	options.bpRowCounter = 1;
	for(var item in options.settings["blocked-pages"]) {
		item = options.settings["blocked-pages"][item];
		bp_addRow(item, options.bpRowCounter);
		options.bpRowCounter += 1;
	}

	bp_addNewRow();

	bp_placeholder();
}

options.initAbout = function() {
	$("#tab-about em.versionCIP").text(chrome.app.getDetails().version);
}