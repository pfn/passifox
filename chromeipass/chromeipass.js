// contains already called method names
var _called = {};

chrome.extension.onMessage.addListener(function(req, sender, callback) {
	if ('action' in req) {
		if(req.action == "fill_user_pass_with_specific_login") {
			if(cip.credentials[req.id]) {
				if (cip.u) {
					cip.u.val(cip.credentials[req.id].Login);
					cip.u.focus();
				}
				if (cip.p) {
					cip.p.val(cip.credentials[req.id].Password);
				}
			}
			// wish I could clear out _logins and _u, but a subsequent
			// selection may be requested.
		}
		else if (req.action == "fill_user_pass") {
			cip.fillInFromActiveElement(false);
		}
		else if (req.action == "fill_pass_only") {
			cip.fillInFromActiveElementPassOnly(false);
		}
		else if (req.action == "choose_credential_fields") {
			cipDefine.init();
		}
		else if (req.action == "clear_credentials") {
			cipEvents.clearCredentials();
		}
		else if (req.action == "activated_tab") {
			cipEvents.triggerActivatedTab();
		}
		else if (req.action == "redetect_fields") {
			chrome.extension.sendMessage({
				"action": "get_settings",
			}, function(response) {
				cip.settings = response.data;
				cip.initCredentialFields(true);
			});
		}
	}
});

// Hotkeys for every page
// ctrl + shift + p = fill only password
// ctrl + shift + u = fill username + password
window.addEventListener("keydown", function(e) {
	if (e.ctrlKey && e.shiftKey) {
		if (e.keyCode == 80) { // P
			e.preventDefault();
			cip.fillInFromActiveElementPassOnly(false);
		} else if (e.keyCode == 85) { // U
			e.preventDefault();
			cip.fillInFromActiveElement(false);
		}
	}
}, false);

function _f(fieldId) {
	var field = (fieldId) ? cIPJQ("#"+fieldId) : [];
	return (field.length > 0) ? field : null;
}



var cipAutocomplete = {};

// objects of username + description for autocomplete
cipAutocomplete.elements = [];

cipAutocomplete.init = function(field) {
	if(field.hasClass("cip-ui-autocomplete-input")) {
		//_f(credentialInputs[i].username).autocomplete("source", autocompleteSource);
		field.autocomplete("destroy");
	}

	field
		.autocomplete({
			minLength: 0,
			source: cipAutocomplete.onSource,
			select: cipAutocomplete.onSelect,
			open: cipAutocomplete.onOpen
		})
		.focus(cipAutocomplete.onFocus)
		.click(cipAutocomplete.onClick)
		.blur(cipAutocomplete.onBlur);
}

cipAutocomplete.onClick = function() {
	cIPJQ(this).autocomplete( "search", cIPJQ(this).val());
}

cipAutocomplete.onOpen = function(event, ui) {
	// NOT BEAUTIFUL!
	// modifies ALL ui-autocomplete menus, also those which aren't from us
	// TODO: find a way to get the corresponding dropdown menu to a login field
	cIPJQ("ul.cip-ui-autocomplete.cip-ui-menu").css("z-index", 10000);
}

cipAutocomplete.onSource = function (request, callback) {
	var matches = cIPJQ.map( cipAutocomplete.elements, function(tag) {
		if ( tag.label.toUpperCase().indexOf(request.term.toUpperCase()) === 0 ) {
			return tag;
		}
	});
	callback(matches);
}

cipAutocomplete.onSelect = function (e, ui) {
	e.preventDefault();
	cIPJQ(this).val(ui.item.value);
	var fieldId = cipFields.prepareId(cIPJQ(this).attr("id"));
	var combination = cipFields.getCombination("username", fieldId);
	combination.loginId = ui.item.loginId;
	cip.fillInCredentials(combination, true, false);
	cIPJQ(this).data("fetched", true);
}

cipAutocomplete.onBlur = function() {
	if(cIPJQ(this).data("fetched") == true) {
		cIPJQ(this).data("fetched", false);
	}
	else {
		var fieldId = cipFields.prepareId(cIPJQ(this).attr("id"));
		var fields = cipFields.getCombination("username", fieldId);
		if(_f(fields.password) && _f(fields.password).data("unchanged") != true) {
			cip.fillInCredentials(fields, true, true);
		}
	}
}

cipAutocomplete.onFocus = function() {
	cip.u = cIPJQ(this);

	if(cIPJQ(this).val() == "") {
		cIPJQ(this).autocomplete( "search", "" );
	}
}



var cipForm = {};

cipForm.init = function(form, credentialFields) {
	// TODO: could be called multiple times --> update credentialFields

	// not already initialized && password-field is not null
	if(!form.data("cipForm-initialized") && credentialFields.password) {
		form.data("cipForm-initialized", true);
		cipForm.setInputFields(form, credentialFields);
		form.submit(cipForm.onSubmit);
	}
}

cipForm.setInputFields = function(form, credentialFields) {
	form.data("cipUsername", credentialFields.username);
	form.data("cipPassword", credentialFields.password);
}

cipForm.onSubmit = function() {
	var usernameId = cIPJQ(this).data("cipUsername");
	var passwordId = cIPJQ(this).data("cipPassword");

	var usernameValue = "";
	var passwordValue = "";

	if(_f(usernameId)) {
		usernameValue = _f(usernameId).val();
	}
	if(_f(passwordId)) {
		passwordValue = _f(passwordId).val();
	}

	// no password given or field cleaned by a site-running script
	// --> no password to save
	if(passwordValue == "") {
		return true;
	}

	var usernameExists = false;

	var nothingChanged = false;
	for(var i = 0; i < cip.credentials.length; i++) {
		if(cip.credentials[i].Login == usernameValue && cip.credentials[i].Password == passwordValue) {
			nothingChanged = true;
			break;
		}

		if(cip.credentials[i].Login == usernameValue) {
			usernameExists = true;
		}
	}

	if(!nothingChanged) {
		if(!usernameExists) {
			for(var i = 0; i < cip.credentials.length; i++) {
				if(cip.credentials[i].Login == usernameValue) {
					usernameExists = true;
					break;
				}
			}
		}
		var credentialsList = [];
		for(var i = 0; i < cip.credentials.length; i++) {
			credentialsList.push({
				"Login": cip.credentials[i].Login,
				"Name": cip.credentials[i].Name,
				"Uuid": cip.credentials[i].Uuid
			});
		}

		var url = cIPJQ(this)[0].action;
		if(!url) {
			url = document.location.href;
			if(url.indexOf("?") > 0) {
				url = url.substring(0, url.indexOf("?"));
				if(url.length < document.location.origin.length) {
					url = document.location.origin;
				}
			}
		}

		chrome.extension.sendMessage({
			'action': 'set_remember_credentials',
			'args': [usernameValue, passwordValue, url, usernameExists, credentialsList]
		});
	}
}



var cipDefine = {};

cipDefine.init = function () {
	var $backdrop = cIPJQ("<div>").attr("id", "b2c-backdrop").addClass("b2c-modal-backdrop");
	cIPJQ("body").append($backdrop);

	var $chooser = cIPJQ("<div>").attr("id", "b2c-cipDefine-fields");
	cIPJQ("body").append($chooser);

	var $description = cIPJQ("<div>").attr("id", "b2c-cipDefine-description");
	$backdrop.append($description);

	cipDefine.initDraggit();
	cipDefine.initDescription();

	cipDefine.prepareStep1();
	cipDefine.markAllUsernameFields($chooser);
}

/**
 * Move an element with the mouse.
 * Needed for choosing credentials.
 * @returns null
 */
cipDefine.initDraggit = function () {
	if("initDraggit" in _called) {
		return;
	}

	_called.initDraggit = true;

	/* PlugTrade.com - jQuery draggit Function */
	/* Drag A Div with jQuery */
	cIPJQ.fn.draggit = function (el) {
		var thisdiv = this;
		var thistarget = cIPJQ(el);
		var relX;
		var relY;
		var targetw = thistarget.width();
		var targeth = thistarget.height();
		var docw;
		var doch;
		var ismousedown;

		thistarget.css('position','absolute');


		thisdiv.bind('mousedown', function(e){
			var pos = cIPJQ(el).offset();
			var srcX = pos.left;
			var srcY = pos.top;

			docw = cIPJQ('body').width();
			doch = cIPJQ('body').height();

			relX = e.pageX - srcX;
			relY = e.pageY - srcY;

			ismousedown = true;
		});

		cIPJQ(document).bind('mousemove',function(e){
			if(ismousedown)
			{
				targetw = thistarget.width();
				targeth = thistarget.height();

				var maxX = docw - targetw - 10;
				var maxY = doch - targeth - 10;

				var mouseX = e.pageX;
				var mouseY = e.pageY;

				var diffX = mouseX - relX;
				var diffY = mouseY - relY;

				// check if we are beyond document bounds ...
				if(diffX < 0)   diffX = 0;
				if(diffY < 0)   diffY = 0;
				if(diffX > maxX) diffX = maxX;
				if(diffY > maxY) diffY = maxY;

				cIPJQ(el).css('top', (diffY)+'px');
				cIPJQ(el).css('left', (diffX)+'px');
			}
		});

		cIPJQ(window).bind('mouseup', function(e){
			ismousedown = false;
		});

		return this;
	} // end jQuery draggit function //
}

cipDefine.initDescription = function() {
	var $description = cIPJQ("div#b2c-cipDefine-description");
	var $h1 = cIPJQ("<div>").addClass("b2c-chooser-headline");
	$description.append($h1);

	var $btnDismiss = cIPJQ("<button>").text("Dismiss").attr("id", "b2c-btn-dismiss")
		.addClass("b2c-btn").addClass("b2c-btn-danger")
		.click(function(e) {
			cIPJQ("div#b2c-backdrop").remove();
			cIPJQ("div#b2c-cipDefine-fields").remove();
		});
	var $btnSkip = cIPJQ("<button>").text("Skip").attr("id", "b2c-btn-skip")
		.addClass("b2c-btn").addClass("b2c-btn-info")
		.css("margin-right", "5px")
		.click(function() {
			if(!cIPJQ("div#b2c-cipDefine-fields").data("username")) {
				cIPJQ("div#b2c-cipDefine-fields").data("username", null);
				cipDefine.prepareStep2();
			}
			else {
				cIPJQ("div#b2c-cipDefine-fields").data("password", null);
				cipDefine.prepareStep3();
			}
			cIPJQ(this).hide();
		});
	var $btnAgain = cIPJQ("<button>").text("Again").attr("id", "b2c-btn-again")
		.addClass("b2c-btn").addClass("b2c-btn-warning")
		.css("margin-right", "5px")
		.click(function(e) {
			cipDefine.prepareStep1();
			cipDefine.markAllUsernameFields(cIPJQ("#b2c-cipDefine-fields"));
		})
		.hide();
	var $btnConfirm = cIPJQ("<button>").text("Confirm").attr("id", "b2c-btn-confirm")
		.addClass("b2c-btn").addClass("b2c-btn-primary")
		.css("margin-right", "15px")
		.click(function(e) {
			if(!cip.settings["defined-credential-fields"]) {
				cip.settings["defined-credential-fields"] = {};
			}

			var usernameId = cIPJQ("div#b2c-cipDefine-fields").data("username");
			if(usernameId) {
				usernameId = cipFields.prepareId(usernameId);
			}

			var passwordId = cIPJQ("div#b2c-cipDefine-fields").data("password");
			if(passwordId) {
				passwordId = cipFields.prepareId(passwordId);
			}

			cip.settings["defined-credential-fields"][document.location.origin] = {
				"username": usernameId,
				"password": passwordId
			};

			chrome.extension.sendMessage({
				action: 'save_settings',
				args: [cip.settings]
			});

			cIPJQ("button#b2c-btn-dismiss").click();
		})
		.hide();

	$description.append($btnConfirm);
	$description.append($btnSkip);
	$description.append($btnAgain);
	$description.append($btnDismiss);

	if(cip.settings["defined-credential-fields"] && cip.settings["defined-credential-fields"][document.location.origin]) {
		var $p = cIPJQ("<p>").html("For this page credential fields are already selected and will be overwritten.<br />");
		var $btnDiscard = cIPJQ("<button>")
			.attr("id", "b2c-btn-discard")
			.text("Discard selection")
			.css("margin-top", "5px")
			.addClass("b2c-btn")
			.addClass("b2c-btn-small")
			.addClass("b2c-btn-danger")
			.click(function(e) {
				delete cip.settings["defined-credential-fields"][document.location.origin];

				chrome.extension.sendMessage({
					action: 'save_settings',
					args: [cip.settings]
				});

				chrome.extension.sendMessage({
					action: 'load_settings'
				});

				cIPJQ(this).parent("p").remove();
			});
		$p.append($btnDiscard);
		$description.append($p);
	}

	cIPJQ("div#b2c-backdrop").draggit("div#b2c-cipDefine-description");
}

cipDefine.markAllUsernameFields = function ($chooser) {
	cIPJQ("input[type='text'], input[type='email'], input:not([type])").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			var $field = cIPJQ("<div>").addClass("b2c-fixed-field")
				.css("top", cIPJQ(this).offset().top)
				.css("left", cIPJQ(this).offset().left)
				.css("width", cIPJQ(this).outerWidth())
				.css("height", cIPJQ(this).outerHeight())
				.data("id", cIPJQ(this).attr("id"))
				.click(function(e) {
					cIPJQ("div#b2c-cipDefine-fields").data("username", cIPJQ(this).data("id"));
					cIPJQ(this).addClass("b2c-fixed-username-field").text("Username").unbind("click");
					cipDefine.prepareStep2();
				})
				.hover(function() {cIPJQ(this).addClass("b2c-fixed-hover-field");}, function() {cIPJQ(this).removeClass("b2c-fixed-hover-field");});
			$chooser.append($field);
		}
	});
}

cipDefine.markAllPasswordFields = function ($chooser) {
	cIPJQ("input[type='password']").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			var $field = cIPJQ("<div>").addClass("b2c-fixed-field")
				.css("top", cIPJQ(this).offset().top)
				.css("left", cIPJQ(this).offset().left)
				.css("width", cIPJQ(this).outerWidth())
				.css("height", cIPJQ(this).outerHeight())
				.data("id", cIPJQ(this).attr("id"))
				.click(function(e) {
					cIPJQ("div#b2c-cipDefine-fields").data("password", cIPJQ(this).data("id"));
					cIPJQ(this).addClass("b2c-fixed-password-field").text("Password").unbind("click");
					cipDefine.prepareStep3();
				})
				.hover(function() {cIPJQ(this).addClass("b2c-fixed-hover-field");}, function() {cIPJQ(this).removeClass("b2c-fixed-hover-field");});
			$chooser.append($field);
		}
	});
}

cipDefine.prepareStep1 = function() {
	cIPJQ("div#b2c-cipDefine-fields").removeData("username");
	cIPJQ("div#b2c-cipDefine-fields").removeData("password");
	cIPJQ("div.b2c-fixed-field", cIPJQ("div#b2c-cipDefine-fields")).remove();
	cIPJQ("div:first", cIPJQ("div#b2c-cipDefine-description")).text("1. Choose a username field");
	cIPJQ("button#b2c-btn-skip").show();
	cIPJQ("button#b2c-btn-confirm").hide();
	cIPJQ("button#b2c-btn-again").hide();
}

cipDefine.prepareStep2 = function() {
	cIPJQ("div.b2c-fixed-field:not(.b2c-fixed-username-field)", cIPJQ("div#b2c-cipDefine-fields")).remove();
	cIPJQ("div:first", cIPJQ("div#b2c-cipDefine-description")).text("2. Now choose a password field");
	cIPJQ("button#b2c-btn-again").show();
	cipDefine.markAllPasswordFields(cIPJQ("#b2c-cipDefine-fields"));
}

cipDefine.prepareStep3 = function() {
	cIPJQ("div.b2c-fixed-field:not(.b2c-fixed-password-field,.b2c-fixed-username-field)", cIPJQ("div#b2c-cipDefine-fields")).remove();
	cIPJQ("button#b2c-btn-confirm").show();
	cIPJQ("button#b2c-btn-skip").hide();
	cIPJQ("div:first", cIPJQ("div#b2c-cipDefine-description")).text("3. Confirm selection");
}



cipFields = {}

cipFields.inputQueryPattern = "input[type='text'], input[type='email'], input[type='password'], input:not([type])";
// unique number as new IDs for input fields
cipFields.uniqueNumber = 342845638;
// all possible inputs for credentials
cipFields.inputs = [];
// objects with combination of username + password fields
cipFields.combinations = [];

cipFields.setUniqueId = function(field) {
	if(field && !field.attr("id")) {
		cipFields.uniqueNumber += 1;
		field.attr("id", "cIPJQ"+String(cipFields.uniqueNumber));
	}
}

cipFields.prepareId = function(id) {
	id = id.replace(":", "\\:")
		.replace("#", "\\#")
		.replace(".", "\\.")
		.replace(",", "\\,")
		.replace("[", "\\[")
		.replace("]", "\\]")
		.replace("(", "\\(")
		.replace(")", "\\)")
		.replace("'", "\\'")
		.replace(" ", "\\ ")
		.replace("\"", "\\\"");
	return id;
}

cipFields.getAllFields = function() {
	var fields = [];
	// get all input fields which are text, email or password and visible
	cIPJQ(cipFields.inputQueryPattern).each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			cipFields.setUniqueId(cIPJQ(this));
			fields.push(cIPJQ(this));
		}
	});

	return fields;
}

cipFields.getAllCombinations = function(inputs) {
	var fields = [];
	var uField = null;
	for(var i = 0; i < inputs.length; i++) {
		if(!inputs[i] || inputs[i].length < 1) {
			continue;
		}

		if(inputs[i].attr("type") == "password") {
			var uId = (!uField || uField.length < 1) ? null : cipFields.prepareId(uField.attr("id"));

			var combination = {
				"username": uId,
				"password": cipFields.prepareId(inputs[i].attr("id"))
			};
			fields.push(combination);

			// reset selected username field
			uField = null;
		}
		else {
			// username field
			uField = inputs[i];
		}
	}

	return fields;
}

cipFields.getCombination = function(givenType, fieldId) {
	for(var i = 0; i < cipFields.combinations.length; i++) {
		if(cipFields.combinations[i][givenType] == fieldId) {
			return cipFields.combinations[i];
		}
	}

	// find new combination
	var combination = {
		"username": null,
		"password": null
	};

	if(givenType == "username") {
		var passwordField = cipFields.getPasswordField(fieldId, true);
		var passwordId = null;
		if(passwordField && passwordField.length > 0) {
			passwordId = cipFields.prepareId(passwordField.attr("id"));
		}
		combination = {
			"username": fieldId,
			"password": passwordId
		};
	}
	else if(givenType == "password") {
		var usernameField = cipFields.getUsernameField(fieldId, true);
		var usernameId = null;
		if(usernameField && usernameField.length > 0) {
			usernameId = cipFields.prepareId(usernameField.attr("id"));
		}
		combination = {
			"username": usernameId,
			"password": fieldId
		};
	}

	if(combination.username || combination.password) {
		cipFields.combinations.push(combination);
	}

	if(combination.username) {
		if(cip.credentials.length > 0) {
			cip.preparePageForMultipleCredentials(cip.credentials);
		}
	}

	return combination;
}

/**
* return the username field or null if it not exists
*/
cipFields.getUsernameField = function(passwordId, checkDisabled) {
	var passwordField = _f(passwordId);
	if(!passwordField) {
		return null;
	}

	var form = passwordField.closest("form")[0];
	var usernameField = null;

	// search all inputs on this one form
	if(form) {
		cIPJQ(cipFields.inputQueryPattern, form).each(function() {
			cipFields.setUniqueId(cIPJQ(this));
			if(cIPJQ(this).attr("id") == passwordId) {
				// break
				return false;
			}

			if(cIPJQ(this).attr("type") == "password") {
				// continue
				return true;
			}

			usernameField = cIPJQ(this);
		});
	}
	// search all inputs on page
	else {
		var inputs = cipFields.getAllFields();
		for(var i = 0; i < inputs.length; i++) {
			if(inputs[i].attr("id") == passwordId) {
				break;
			}

			if(inputs[i].attr("type") == "password") {
				continue;
			}

			usernameField = inputs[i];
		}
	}

	if(usernameField && !checkDisabled) {
		var usernameId = usernameField.attr("id");
		// check if usernameField is already used by another combination
		for(var i = 0; i < cipFields.combinations.length; i++) {
			if(cipFields.combinations[i].username == usernameId) {
				usernameField = null;
				break;
			}
		}
	}

	cipFields.setUniqueId(usernameField);

	return usernameField;
}

/**
* return the password field or null if it not exists
*/
cipFields.getPasswordField = function(usernameId, checkDisabled) {
	var usernameField = _f(usernameId);
	if(!usernameField) {
		return null;
	}

	var form = usernameField.closest("form")[0];
	var passwordField = null;

	// search all inputs on this one form
	if(form) {
		passwordField = cIPJQ("input[type='password']:first", form);
		if(passwordField.length < 1) {
			passwordField = null;
		}
	}
	// search all inputs on page
	else {
		var inputs = cipFields.getAllFields();
		var active = false;
		for(var i = 0; i < inputs.length; i++) {
			if(inputs[i].attr("id") == usernameId) {
				active = true;
			}
			if(cIPJQ(inputs[i]).attr("type") != "password") {
				continue;
			}

			if(active) {
				passwordField = inputs[i];
				break;
			}
		}
	}

	if(passwordField && !checkDisabled) {
		var passwordId = passwordField.attr("id");
		// check if passwordField is already used by another combination
		for(var i = 0; i < cipFields.combinations.length; i++) {
			if(cipFields.combinations[i].password == passwordId) {
				passwordField = null;
				break;
			}
		}
	}

	cipFields.setUniqueId(passwordField);

	return passwordField;
}

cipFields.prepareCombinations = function(combinations) {
	for(var i = 0; i < combinations.length; i++) {
		// disable autocomplete for username field
		if(combinations[i].username) {
			_f(combinations[i].username).attr("autocomplete", "off");
		}

		var pwField = _f(combinations[i].password);
		// needed for auto-complete: don't overwrite manually filled-in password field
		if(pwField && !pwField.data("cipFields-onChange")) {
			pwField.data("cipFields-onChange", true);
			pwField.change(function() {
				cIPJQ(this).data("unchanged", false);
			});
		}

		// initialize form-submit for remembering credentials
		var fieldId = combinations[i].password || combinations[i].username;
		var form = _f(fieldId).closest("form");
		if(form && form.length > 0) {
			cipForm.init(form, combinations[i]);
		}
	}
}

cipFields.useDefinedCredentialFields = function() {
	if(cip.settings["defined-credential-fields"] && cip.settings["defined-credential-fields"][document.location.origin]) {
		var creds = cip.settings["defined-credential-fields"][document.location.origin];
		if(_f(creds.username) || _f(creds.password)) {
			var fields = {
				"username": creds.username,
				"password": creds.password
			};
			cipFields.combinations = [];
			cipFields.combinations.push(fields);

			return true;
		}
	}

	return false;
}



var cip = {};

// settings of chromeIPass
cip.settings = {};
// username field which will be set on focus
cip.u = null;
// password field which will be set on focus
cip.p = null;
// document.location
cip.url = null;
// request-url of the form in which the field is located
cip.submitUrl = null;
// received credentials from KeePassHTTP
cip.credentials = [];

cIPJQ(function() {
	cip.init();
});

cip.init = function() {
	chrome.extension.sendMessage({
		"action": "get_settings",
	}, function(response) {
		cip.settings = response.data;
		cip.initCredentialFields();
	});
}

cip.initCredentialFields = function(forceCall) {
	if(_called.initCredentialFields && !forceCall) {
		return;
	}
	_called.initCredentialFields = true;


	cipFields.inputs = cipFields.getAllFields();

	if(!cipFields.useDefinedCredentialFields()) {
		// get all combinations of username + password fields
		cipFields.combinations = cipFields.getAllCombinations(cipFields.inputs);
	}
	cipFields.prepareCombinations(cipFields.combinations);

	if(cipFields.combinations.length == 0) {
		chrome.extension.sendMessage({
			'action': 'show_default_browseraction'
		});
		return;
	}

	cip.url = document.location.origin;
	cip.submitUrl = cip.getFormActionUrl(cipFields.combinations[0]);

	chrome.extension.sendMessage({
		'action': 'retrieve_credentials',
		'args': [ cip.url, cip.submitUrl ]
	}, cip.retrieveCredentialsCallback);
} // end function init

cip.retrieveCredentialsCallback = function (credentials) {
	if (cipFields.combinations.length > 0) {
		cip.u = _f(cipFields.combinations[0].username);
		cip.p = _f(cipFields.combinations[0].password);
	}

	// only one login for this site
	if (credentials.length == 1) {
		if(cip.u) {
			cip.u.val(credentials[0].Login);
		}
		if(cip.p) {
			cip.p.val(credentials[0].Password);
		}
		cip.credentials = credentials;

		// generate popup-list of usernames + descriptions
		chrome.extension.sendMessage({
			'action': 'popup_login',
			'args': [[credentials[0].Login + " (" + credentials[0].Name + ")"]]
		});
	}
	//multiple logins for this site
	else if (credentials.length > 1) {
		cip.credentials = credentials;
		cip.preparePageForMultipleCredentials(cip.credentials);
	}
}

cip.preparePageForMultipleCredentials = function(credentials) {
	// add usernames + descriptions to autocomplete-list and popup-list
	var usernames = [];
	cipAutocomplete.elements = [];
	for(var i = 0; i < credentials.length; i++) {
		usernames.push(credentials[i].Login + " (" + credentials[i].Name + ")");
		var item = {
			"label": credentials[i].Login + " (" + credentials[i].Name + ")",
			"value": credentials[i].Login,
			"loginId": i
		};
		cipAutocomplete.elements.push(item);
	}

	// generate popup-list of usernames + descriptions
	chrome.extension.sendMessage({
		'action': 'popup_login',
		'args': [usernames]
	});

	// initialize autocomplete for username fields
	if(cip.settings.autoCompleteUsernames) {
		for(var i = 0; i < cipFields.combinations.length; i++) {
			if(_f(cipFields.combinations[i].username)) {
				cipAutocomplete.init(_f(cipFields.combinations[i].username));
			}
		}
	}
}

cip.getFormActionUrl = function(combination) {
	var field = combination.password || combination.username;
	var form = _f(field).closest("form");
	var action = null;

	if(form && form.length > 0) {
		action = form[0].action;
	}

	if(typeof(action) != "string" || action == "") {
		action = document.location.origin + document.location.pathname;
	}

	return action;
}

cip.fillInCredentials = function(combination, onlyPassword, suppressWarnings) {
	var action = cip.getFormActionUrl(combination);

	var u = _f(combination.username);
	var p = _f(combination.password);

	if(u) {
		cip.u = u;
	}
	if(p) {
		cip.p = p;
	}

	if(cip.url == document.location.origin && cip.submitUrl == action && cip.credentials.length > 0) {
		cip.fillIn(combination, onlyPassword, suppressWarnings);
	}
	else {
		cip.url = document.location.origin;
		cip.submitUrl = action;

		chrome.extension.sendMessage({
			'action': 'retrieve_credentials',
			'args': [ cip.url, cip.submitUrl ]
		}, function(credentials) {
			cip.retrieveCredentialsCallback(credentials);
			cip.fillIn(combination, onlyPassword, suppressWarnings);
		});
	}
}

cip.fillInFromActiveElement = function(suppressWarnings) {
	var el = document.activeElement;
	if (el.tagName.toLowerCase() != "input") {
		return;
	}

	cipFields.setUniqueId(cIPJQ(el));
	var fieldId = cipFields.prepareId(cIPJQ(el).attr("id"));
	var combination = null;
	if(el.type.toLowerCase() == "password") {
		combination = cipFields.getCombination("password", fieldId);
	}
	else {
		combination = cipFields.getCombination("username", fieldId);
	}

	delete combination.loginId;

	cip.fillInCredentials(combination, false, suppressWarnings);
}

cip.fillInFromActiveElementPassOnly = function(suppressWarnings) {
	var el = document.activeElement;
	if (el.tagName.toLowerCase() != "input") {
		return;
	}

	cipFields.setUniqueId(cIPJQ(el));
	var fieldId = cipFields.prepareId(cIPJQ(el).attr("id"));
	var combination = null;
	if(el.type.toLowerCase() == "password") {
		combination = cipFields.getCombination("password", fieldId);
	}
	else {
		combination = cipFields.getCombination("username", fieldId);
	}

	if(!_f(combination.password)) {
		var message = "Unable to find a password field";
		chrome.extension.sendMessage({
			action: 'alert',
			args: [message]
		});
		return;
	}

	delete combination.loginId;

	cip.fillInCredentials(combination, true, suppressWarnings);
}

cip.fillIn = function(combination, onlyPassword, suppressWarnings) {
	// no credentials available
	if (cip.credentials.length == 0 && !suppressWarnings) {
		var message = "No logins found.";
		chrome.extension.sendMessage({
			action: 'alert',
			args: [message]
		});
		return;
	}

	// exactly one pair of credentials available
	if (cip.credentials.length == 1) {
		if(_f(combination.username) && _f(combination.username).length > 0 && !onlyPassword) {
			_f(combination.username).val(cip.credentials[0].Login);
		}
		if(_f(combination.password) && _f(combination.password).length > 0) {
			_f(combination.password)[0].type = "password";
			_f(combination.password).val(cip.credentials[0].Password);
			_f(combination.password).data("unchanged", true);
		}
	}
	// multiple credentials available
	else {
		// check if only one password for given username exists
		var countPasswords = 0;

		var uField = _f(combination.username);
		if(uField) {
			var valPassword = "";
			var valUsername = uField.val();

			// specific login id given
			if(combination.loginId != undefined && cip.credentials[combination.loginId]) {
				if(cip.credentials[combination.loginId].Login == valUsername) {
					countPasswords += 1;
					valPassword = cip.credentials[combination.loginId].Password;
				}
			}
			// find passwords to given username
			else {
				for (var i = 0; i < cip.credentials.length; i++) {
					if(cip.credentials[i].Login == valUsername) {
						countPasswords += 1;
						valPassword = cip.credentials[i].Password;
					}
				}

				if(countPasswords == 0 && !onlyPassword) {
					countPasswords = cip.credentials.length;
				}
			}

			// only one mapping username found
			if(countPasswords == 1) {
				if(_f(combination.password)) {
					_f(combination.password).val(valPassword);
					_f(combination.password).data("unchanged", true);
				}
			}
		}
		else {
			var valPassword = "";

			// specific login id given
			if(combination.loginId != undefined && cip.credentials[combination.loginId]) {
				_f(combination.password).val(cip.credentials[combination.loginId].Password);
				_f(combination.password).data("unchanged", true);
				countPasswords += 1;
			}
		}

		// user has to select correct credentials by himself
		if(countPasswords > 1) {
			if(!suppressWarnings) {
				var message = "More than one login was found in KeePass!\n" +
				"Press the chromeIPass icon for more options.";
				chrome.extension.sendMessage({
					action: 'alert',
					args: [message]
				});
			}
		}
		else if(countPasswords < 1) {
			if(!suppressWarnings) {
				var message = "No logins found.";
				chrome.extension.sendMessage({
					action: 'alert',
					args: [message]
				});
			}
		}
	}
}



cipEvents = {};

cipEvents.clearCredentials = function() {
	cip.credentials = [];
	cipAutocomplete.elements = [];

	if(cip.settings.autoCompleteUsernames) {
		for(var i = 0; i < cipFields.combinations.length; i++) {
			var uField = _f(cipFields.combinations[i].username);
			if(uField) {
				if(uField.hasClass("cip-ui-autocomplete-input")) {
					uField.autocomplete("destroy");
				}
			}
		}
	}
}

cipEvents.triggerActivatedTab = function() {
	// doesn't run a second time because of _called.initCredentialFields set to true
	cip.init();

	// initCredentialFields calls also "retrieve_credentials", to prevent it
	// check of init() was already called
	if(_called.initCredentialFields && (cip.url || cip.submitUrl)) {
		chrome.extension.sendMessage({
			'action': 'retrieve_credentials',
			'args': [ cip.url, cip.submitUrl ]
		}, cip.retrieveCredentialsCallback);
	}
}