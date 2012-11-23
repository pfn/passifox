// unique number as new IDs for input fields
var uniqueNum = Math.floor( Math.random()*99999 );
// settings of chromeIPass
var _settings = {};
// all possible inputs for credentials
var inputs = [];
// object with combination of username + password fields
var credentialInputs = [];
// objects of username + description for autocomplete
var autocompleteElements = [];
// username field
var _u = null;
// password field
var _p = null;
// username fields are prepared
var preparedUsernameFields = false;
// received credentials from KeePassHTTP
var _credentials = {
	"url" : null,
	"submiturl": null,
	"logins" : []
};

(function() {
	// get all input fields which are text, email or password and visible
	cIPJQ("input[type='text'], input[type='email'], input[type='password'], input:not([type])").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			inputs.push(cIPJQ(this));
		}
	});

	// get all combinations of username + password fields
	for(var i = 0; i < inputs.length; i++) {
		if(cIPJQ(inputs[i]).attr("type") == "password") {
			var u = getUsernameFieldFromPasswordField(inputs[i], false);
			// disable autocomplete for username field
			if(u) {
				if(!u.attr("id")) {
					uniqueNum += 1;
					u.attr("id", "cIPJQ"+String(uniqueNum));
				}
				u.attr("autocomplete", "off");
			}


			if(!inputs[i].attr("id")) {
				uniqueNum += 1;
				inputs[i].attr("id", "cIPJQ"+String(uniqueNum));
			}

			cIPJQ(inputs[i]).change(function() {
				cIPJQ(this).data("unchanged", false);
			});

			var fields = {
				"username": u.attr("id"),
				"password": inputs[i].attr("id")
			};
			credentialInputs.push(fields);
		}
	}

	chrome.extension.sendRequest({
		"action": "get_settings"
	}, function(response) {
		_settings = response.data;
		init();
	});
})();

function init() {
	if(credentialInputs.length == 0) {
		chrome.extension.sendRequest({
			'action': 'hide_actions'
		});
	}
	else {
		var form = (_f(credentialInputs[0].username)) ? _f(credentialInputs[0].username).closest("form") : null;
		var action = null;

		if(form) {
			action = form[0].action;
		}

		if (typeof(action) != "string" || action == "") {
			action = document.location.origin + document.location.pathname;
		}

		_credentials.url = document.location.origin;
		_credentials.submiturl = action;

		chrome.extension.sendRequest({
			'action': 'get_passwords',
			'args': [ document.location.origin, action ]
		}, _logins_callback);
	}

	window.addEventListener("keydown", function(e) {
		if (e.ctrlKey && e.shiftKey) {
			if (e.keyCode == 80) { // P
				fillInFromActiveElementPassOnly(false);
			} else if (e.keyCode == 85) { // U
				fillInFromActiveElement(false);
			}
		}
	}, false);

	chrome.extension.onRequest.addListener(function onRequest(req) {
		// normal page
		if ('id' in req) {
			if (_u) {
				_u.val(_credentials.logins[req.id].Login);
				_u.focus();
			}
			if (_p) {
				_p.val(_credentials.logins[req.id].Password);
			}
		// wish I could clear out _logins and _u, but a subsequent
		// selection may be requested.
		}
		if ('action' in req) {
			if (req.action == "fill_user_pass") {
				fillInFromActiveElement(false);
			} else if (req.action == "fill_pass_only") {
				fillInFromActiveElementPassOnly(false);
			}
		}
	});
} // end function init



/**
	 * return the username field or null if it not exists
	 */
function getUsernameFieldFromPasswordField(passwordField, checkDisabled) {
	var form = cIPJQ(passwordField).closest("form");
	var usernameField = null;

	// search all inputs on this one form
	if(form[0]) {
		cIPJQ("input[type='text'], input[type='email'], input[type='password'], input:not([type])", form[0]).each(function() {
			if(cIPJQ(this)[0] == cIPJQ(passwordField)[0]) {
				return false;
			}

			if(cIPJQ(this).attr("type") == "password") {
				return true;
			}

			usernameField = cIPJQ(this);
		});
	}
	// search all inputs on page
	else {
		for(var i = 0; i < inputs.length; i++) {
			if(cIPJQ(inputs[i])[0] == cIPJQ(passwordField)[0]) {
				break;
			}

			if(cIPJQ(inputs[i]).attr("type") == "password") {
				continue;
			}

			usernameField = cIPJQ(inputs[i]);
		}
	}

	if(usernameField && !checkDisabled) {
		// check if lastInput is already used by another password field
		for(var i = 0; i < credentialInputs.length; i++) {
			if(_f(credentialInputs[i].username)[0] == usernameField[0]) {
				usernameField = null;
				break;
			}
		}
	}

	return usernameField;
}

/**
	 * return the password field or null if it not exists
	 */
function getPasswordFieldFromUsernameField(usernameField, checkDisabled) {
	var form = cIPJQ(usernameField).closest("form");
	var passwordField = null;

	// search all inputs on this one form
	if(form[0]) {
		passwordField = cIPJQ(cIPJQ("input[type='password']", form[0])[0]);
	}
	// search all inputs on page
	else {
		var active = false;
		for(var i = 0; i < inputs.length; i++) {
			if(cIPJQ(inputs[i])[0] == cIPJQ(usernameField)[0]) {
				active = true;
			}
			if(cIPJQ(inputs[i]).attr("type") != "password") {
				continue;
			}

			if(active) {
				passwordField = cIPJQ(inputs[i]);
				break;
			}
		}
	}

	if(passwordField && !checkDisabled) {
		// check if lastInput is already used by another password field
		for(var i = 0; i < credentialInputs.length; i++) {
			if(_f(credentialInputs[i].password)[0] == passwordField[0]) {
				passwordField = null;
				break;
			}
		}
	}

	return passwordField;
}



// check for disabled fields?





function _logins_callback(logins) {
	if (credentialInputs.length > 0) {
		_u = _f(credentialInputs[0].username);
		_p = _f(credentialInputs[0].password);
	}

	// only one login for this site
	if (logins.length == 1) {
		if(_u) {
			_u.val(logins[0].Login);
		}
		if(_p) {
			_p.val(logins[0].Password);
		}
		_credentials.logins = logins;

		// generate popup-list of usernames + descriptions
		chrome.extension.sendRequest({
			'action': 'select_login',
			'args': [[logins[0].Login + " (" + logins[0].Name + ")"]]
		});
	}
	//multiple logins for this site
	else if (logins.length > 1) {
		_credentials.logins = logins;
		_preparePageForMultipleCredentials(logins);
	}
}

function _preparePageForMultipleCredentials(logins) {
	// add usernames + descriptions to autocomplete-list and popup-list
	var usernames = [];
	autocompleteElements = [];
	for(var i = 0; i < logins.length; i++) {
		usernames.push(logins[i].Login + " (" + logins[i].Name + ")");
		var item = {
			"label": logins[i].Login + " (" + logins[i].Name + ")",
			"value": logins[i].Login,
			"loginId": i
		};
		autocompleteElements.push(item);
	}

	// generate popup-list of usernames + descriptions
	chrome.extension.sendRequest({
		'action': 'select_login',
		'args': [usernames]
	});

	// initialize autocomplete for username fields
	if(!preparedUsernameFields) {
		preparedUsernameFields = true;
		for(var i = 0; i < credentialInputs.length; i++) {
			if(_f(credentialInputs[i].username)) {
				if(_settings.autoCompleteUsernames) {
					_f(credentialInputs[i].username)
					.autocomplete({
						minLength: 0,
						source: autocompleteSource,
						select: autocompleteSelect
					})
					.focus(autocompleteFocus)
					.click(function() {
						cIPJQ(this).autocomplete( "search", cIPJQ(this).val());
					});
				}
				_f(credentialInputs[i].username)
				.blur(autocompleteBlur)
				.focus(function() {
					_u = cIPJQ(this);
				});
			}
		}
	}
}

function autocompleteSource(request, response) {
	var matches = cIPJQ.map( autocompleteElements, function(tag) {
		if ( tag.label.toUpperCase().indexOf(request.term.toUpperCase()) === 0 ) {
			return tag;
		}
	});
	response(matches);
}

function autocompleteSelect(e, ui) {
	e.preventDefault();
	cIPJQ(this).val(ui.item.value);
	var credentials = getCredentialFields("username", cIPJQ(this));
	credentials.loginId = ui.item.loginId;
	fillInCredentials(credentials, true, false);
	cIPJQ(this).data("fetched", true);
}

function autocompleteBlur() {
	if(cIPJQ(this).data("fetched") == true) {
		cIPJQ(this).data("fetched", false);
	}
	else {
		var credentials = getCredentialFields("username", cIPJQ(this));
		delete credentials.loginId;
		if(_f(credentials.password).data("unchanged") != true) {
			fillInCredentials(credentials, true, true);
		}
	}
}

function autocompleteFocus() {
	if(cIPJQ(this).val() == "") {
		cIPJQ(this).autocomplete( "search", "" );
	}
}

function getCredentialFields(type, field) {
	if(credentialInputs.length == 1) {
		return credentialInputs[0];
	}

	for(var i = 0; i < credentialInputs; i++) {
		if((type == "username" && _f(credentialInputs[i].username)[0] == field[0]) || (type == "password" && _f(credentialInputs[i].password)[0] == field[0])) {
			return credentialInputs[i];
		}
	}

	if(type == "username") {
		return {
			"username": field,
			"password": getPasswordFieldFromUsernameField(field)
		};
	}
	else if(type == "password") {
		return {
			"username": getUsernameFieldFromPasswordField(field, true),
			"password": field
		};
	}

	return {
		"username": null,
		"password": null
	};
}


function fillInCredentials(credentialFields, onlyPassword, suppressWarnings) {
	var form = (_f(credentialFields.username)) ? _f(credentialFields.username).closest("form") : _f(credentialFields.password).closest("form");
	var action = form[0].action;

	var u = _f(credentialFields.username);
	var p = _f(credentialFields.password);

	if(u) {
		_u = u;
	}
	if(p) {
		_p = p;
	}

	if (typeof(action) != "string" || action == "") {
		action = document.location.origin + document.location.pathname;
	}

	if(_credentials.url == document.location.origin && _credentials.submiturl == action) {
		_fillIn(credentialFields, onlyPassword, suppressWarnings);
	}
	else {
		_credentials.url = document.location.origin;
		_credentials.submiturl = action;

		chrome.extension.sendRequest({
			'action': 'get_passwords',
			'args': [ document.location.origin, action ]
		}, function(logins) {
			_logins_callback(logins);
			_fillIn(credentialFields, onlyPassword, suppressWarnings);
		});
	}
}

function fillInFromActiveElement(suppressWarnings) {
	var el = document.activeElement;
	if (el.tagName.toLowerCase() != "input") {
		return;
	}

	var credentialFields = null;
	if(el.type.toLowerCase == "password") {
		credentialFields = getCredentialFields("password", cIPJQ(el));
	}
	else {
		credentialFields = getCredentialFields("username", cIPJQ(el));
	}
	delete credentialFields.loginId;

	fillInCredentials(credentialFields, false, suppressWarnings);
}

function fillInFromActiveElementPassOnly(suppressWarnings) {
	var el = document.activeElement;
	if (el.tagName.toLowerCase() != "input") {
		return;
	}

	var credentialFields = null;
	if(el.type.toLowerCase == "password") {
		credentialFields = getCredentialFields("password", cIPJQ(el));
	}
	else {
		credentialFields = getCredentialFields("username", cIPJQ(el));
	}
	delete credentialFields.loginId;

	if(!_f(credentialFields.password)) {
		var message = "Unable to find a password field";
		chrome.extension.sendRequest({
			action: 'alert',
			args: [message]
		});
		return;
	}

	fillInCredentials(credentialFields, true, suppressWarnings);
}

function _f(fieldId) {
	return cIPJQ("#"+fieldId);
}

function _fillIn(credentialFields, onlyPassword, suppressWarnings) {
	// no credentials available
	if (_credentials.logins.length == 0 && !suppressWarnings) {
		var message = "No logins found.";
		chrome.extension.sendRequest({
			action: 'alert',
			args: [message]
		});
		return;
	}

	// exactly one pair of credentials available
	if (_credentials.logins.length == 1) {
		if (_f(credentialFields.username) && !onlyPassword) {
			_f(credentialFields.username).val(_credentials.logins[0].Login);
		}
		if (_f(credentialFields.password)) {
			_f(credentialFields.password)[0].type = "password";
			_f(credentialFields.password).val(_credentials.logins[0].Password);
			_f(credentialFields.password).data("unchanged", true);
		}
	}
	// multiple credentials available
	else {
		// check if only one password for given username exists
		var countPasswords = 0;

		if(_f(credentialFields.username)) {
			var valPassword = "";

			// specific login id given
			if(credentialFields.loginId != undefined && _credentials.logins[credentialFields.loginId]) {
				if(_credentials.logins[credentialFields.loginId].Login == _f(credentialFields.username).val()) {
					countPasswords += 1;
					valPassword = _credentials.logins[credentialFields.loginId].Password;
				}
			}
			// find passwords to given username
			else {
				for (var i = 0; i < _credentials.logins.length; i++) {
					if(_credentials.logins[i].Login == _f(credentialFields.username).val()) {
						countPasswords += 1;
						valPassword = _credentials.logins[i].Password;
					}
				}
			}

			// only one mapping username found
			if(countPasswords == 1) {
				if(_f(credentialFields.password)) {
					_f(credentialFields.password).val(valPassword);
					_f(credentialFields.password).data("unchanged", true);
				}
			}
		}

		// user has to select correct credentials by himself
		if(countPasswords > 1) {
			if(!suppressWarnings) {
				var message = "More than one login was found in KeePass, " +
				"press the ChromeIPass icon for more options";
				chrome.extension.sendRequest({
					action: 'alert',
					args: [message]
				});
			}
		}
		else if(countPasswords < 1) {
			if(!suppressWarnings) {
				var message = "No logins found.";
				chrome.extension.sendRequest({
					action: 'alert',
					args: [message]
				});
			}
		}
	}
}