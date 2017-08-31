if(cIPJQ) {
	var $ = cIPJQ.noConflict(true);
}

$(function() {
	browser.runtime.sendMessage({ action: 'load_settings' }).then((settings) => {
		options.settings = settings;
		browser.runtime.sendMessage({ action: 'load_keyring' }).then((keyRing) => {
			options.keyRing = keyRing;
			options.initMenu();
			options.initGeneralSettings();
			options.initConnectedDatabases();
			options.initSpecifiedCredentialFields();
			options.initAbout();
		});
	});
});

var options = options || {};

options.saveSettings = function() {
	browser.storage.local.set({'settings': options.settings});
	browser.runtime.sendMessage({
		action: 'load_settings'
	});
};

options.saveKeyRing = function() {
	browser.storage.local.set({'keyRing': options.keyRing});
	browser.runtime.sendMessage({
		action: 'load_keyring'
	});
};

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
		options.saveSettings();
	});

	$("#tab-general-settings input[type=radio]").each(function() {
		if($(this).val() == options.settings[$(this).attr("name")]) {
			$(this).attr("checked", options.settings[$(this).attr("name")]);
		}
	});

	$("#tab-general-settings input[type=radio]").change(function() {
		options.settings[$(this).attr("name")] = $(this).val();
		options.saveSettings();
	});

	browser.runtime.sendMessage({
		action: "get_keepasshttp_versions"
	}).then(options.showKeePassHttpVersions);

	$("#tab-general-settings button.checkUpdateKeePassHttp:first").click(function(e) {
		e.preventDefault();
		$(this).attr("disabled", true);
		browser.runtime.sendMessage({
			action: "check_update_keepasshttp"
		}).then(options.showKeePassHttpVersions);
	});

	$("#showDangerousSettings").click(function() {
		$('#dangerousSettings').is(":visible") ? $(this).text("Show these settings anyway") : $(this).text("Hide");
		$("#dangerousSettings").toggle();
	});

	$("#hostname").val(options.settings["hostname"]);
	$("#port").val(options.settings["port"]);
	$("#blinkTimeout").val(options.settings["blinkTimeout"]);
	$("#blinkMinTimeout").val(options.settings["blinkMinTimeout"]);
	$("#allowedRedirect").val(options.settings["allowedRedirect"]);

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

		options.saveSettings();
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

		options.saveSettings();
	});

	$("#blinkTimeoutButton").click(function(){
		var blinkTimeout = $.trim($("#blinkTimeout").val());
		var blinkTimeoutval = parseInt(blinkTimeout);

		options.settings["blinkTimeout"] = blinkTimeoutval.toString();

		$("#blinkTimeout").closest(".control-group").removeClass("error").addClass("success");
		setTimeout(function() {$("#blinkTimeout").closest(".control-group").removeClass("success")}, 2500);

		options.saveSettings();
	});

	$("#blinkMinTimeoutButton").click(function(){
		var blinkMinTimeout = $.trim($("#blinkMinTimeout").val());
		var blinkMinTimeoutval = parseInt(blinkMinTimeout);

		options.settings["blinkMinTimeout"] = blinkMinTimeoutval.toString();
		$("#blinkMinTimeout").closest(".control-group").removeClass("error").addClass("success");
		setTimeout(function() {$("#blinkMinTimeout").closest(".control-group").removeClass("success")}, 2500);

		options.saveSettings();
	});

	$("#allowedRedirectButton").click(function(){
		var allowedRedirect = $.trim($("#allowedRedirect").val());
		var allowedRedirectval = parseInt(allowedRedirect);

		options.settings["allowedRedirect"] = allowedRedirectval.toString();
		$("#allowedRedirect").closest(".control-group").removeClass("error").addClass("success");
		setTimeout(function() {$("#allowedRedirect").closest(".control-group").removeClass("success")}, 2500);

		options.saveSettings();
	});

	if (!browser.webRequest.onAuthRequired) {
		/* onAuthRequired isn't supported on current Firefox, so hide this feature. */
		$("#http-auth-options").hide();
	}
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
		options.saveKeyRing();

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
		options.saveKeyRing();
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
	$("#connect-button").click(function() {
		browser.runtime.sendMessage({
			action: "associate"
		});
	});
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
		options.saveSettings();

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

options.initAbout = function() {
	var manifest = browser.runtime.getManifest();
	$("#tab-about em.versionCIP").text(manifest.version);
	if (!(/Chrome/.test(navigator.userAgent) && /Google/.test(navigator.vendor))) {
		/* Not Chrome or Chromium  */
		$("#chrome-web-store-link").remove();
	}
}
