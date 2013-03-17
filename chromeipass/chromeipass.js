// unique number as new IDs for input fields
var uniqueNum = 342845638;
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
// init() already called
var _calledInitCredentialFields = false;
var _calledInitDraggit = false;


chrome.extension.onMessage.addListener(function(req, sender, callback) {
	console.log("onMessage("+req.action+")");

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
		}
		else if (req.action == "fill_pass_only") {
			fillInFromActiveElementPassOnly(false);
		}
		else if (req.action == "choose_credential_fields") {
			initChooseInputFields();
		}
		else if (req.action == "clear_credentials") {
			_clearCredentials();
		}
		else if (req.action == "activated_tab") {
			_triggerActivatedTab();
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
			fillInFromActiveElementPassOnly(false);
		} else if (e.keyCode == 85) { // U
			e.preventDefault();
			fillInFromActiveElement(false);
		}
	}
}, false);


(function() {
	init();
})();

function setUniqueId(field) {
	if(!field.attr("id")) {
		uniqueNum += 1;
		field.attr("id", "cIPJQ"+String(uniqueNum));
	}
}

function init() {
	chrome.extension.sendMessage({
		"action": "get_settings",
	}, function(response) {
		_settings = response.data;
		initCredentialFields();
	});
}

function initDraggit() {
	if(_calledInitDraggit) {
		return;
	}
	_calledInitDraggit = true;

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

function initCredentialFields() {
	initDraggit();

	if(_calledInitCredentialFields) {
		return;
	}

	// get all input fields which are text, email or password and visible
	cIPJQ("input[type='text'], input[type='email'], input[type='password'], input:not([type])").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			setUniqueId(cIPJQ(this));
			inputs.push(cIPJQ(this));
		}
	});

	var getAllCombinations = true;
	if(_settings["defined-credential-fields"] && _settings["defined-credential-fields"][document.location.origin]) {
		if(cIPJQ("input#"+_settings["defined-credential-fields"][document.location.origin].username).length == 1 &&
			cIPJQ("input#"+_settings["defined-credential-fields"][document.location.origin].password).length == 1
		) {
			var fields = {
				"username": _settings["defined-credential-fields"][document.location.origin].username,
				"password": _settings["defined-credential-fields"][document.location.origin].password
			};
			credentialInputs.push(fields);

			getAllCombinations = false;
		}
	}

	if(getAllCombinations) {
		// get all combinations of username + password fields
		for(var i = 0; i < inputs.length; i++) {
			if(cIPJQ(inputs[i]).attr("type") == "password") {
				var u = getUsernameFieldFromPasswordField(inputs[i], false);
				if(!u) {
					continue;
				}

				// disable autocomplete for username field
				u.attr("autocomplete", "off");

				cIPJQ(inputs[i]).change(function() {
					cIPJQ(this).data("unchanged", false);
				});

				var fields = {
					"username": _prepareId(u.attr("id")),
					"password": _prepareId(inputs[i].attr("id"))
				};
				credentialInputs.push(fields);

				var form = (_f(fields.username)) ? _f(fields.username).closest("form") : null;
				if(form && form.length > 0) {
					initForm(form, fields);
				}
			}
		}
	}

	if(credentialInputs.length == 0) {
		chrome.extension.sendMessage({
			'action': 'show_default_browseraction',
			'args': []
		});
	}
	else {
		var form = (_f(credentialInputs[0].username)) ? _f(credentialInputs[0].username).closest("form") : null;
		var action = null;

		if(form && form.length > 0) {
			action = form[0].action;
		}

		if (typeof(action) != "string" || action == "") {
			action = document.location.origin + document.location.pathname;
		}

		_credentials.url = document.location.origin;
		_credentials.submiturl = action;

		chrome.extension.sendMessage({
			'action': 'retrieve_credentials',
			'args': [ document.location.origin, action ]
		}, _logins_callback);
	}

	_calledInitCredentialFields = true;
} // end function init



function initForm(form, credentialFields) {
	setFormInputs(form, credentialFields);
	form.submit(formSubmit);
}

function setFormInputs(form, credentialFields) {
	form.data("cipUsername", credentialFields.username);
	form.data("cipPassword", credentialFields.password);
}

function formSubmit() {
	var usernameId = cIPJQ(this).data("cipUsername");
	var passwordId = cIPJQ(this).data("cipPassword");

	var usernameValue = _f(usernameId).val();
	var passwordValue = _f(passwordId).val();

	if(passwordValue == "") {
		return true;
	}

	var usernameExists = false;

	var found = false;
	for(var i = 0; i < _credentials.logins.length; i++) {
		if(_credentials.logins[i].Login == usernameValue && _credentials.logins[i].Password == passwordValue) {
			found = true;
			break;
		}

		if(_credentials.logins[i].Login == usernameValue) {
			usernameExists = true;
		}
	}

	if(!found) {
		if(!usernameExists) {
			for(var i = 0; i < _credentials.logins.length; i++) {
				if(_credentials.logins[i].Login == usernameValue) {
					usernameExists = true;
					break;
				}
			}
		}
		var credentialsList = [];
		for(var i = 0; i < _credentials.logins.length; i++) {
			credentialsList.push({
				"Login": _credentials.logins[i].Login,
				"Name": _credentials.logins[i].Name,
				"Uuid": _credentials.logins[i].Uuid
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

function initChooseInputFields() {
	var $backdrop = cIPJQ("<div>").attr("id", "b2c-backdrop").addClass("b2c-modal-backdrop");
	cIPJQ("body").append($backdrop);

	var $chooser = cIPJQ("<div>").attr("id", "b2c-choose-fields");
	cIPJQ("body").append($chooser);

	var $description = cIPJQ("<div>").attr("id", "b2c-choose-description");
	$backdrop.append($description);

	initChooserDescription();

	chooserMarkAllUsernameFields($chooser);
}

function initChooserDescription() {
	var $description = cIPJQ("div#b2c-choose-description");
	var $h1 = cIPJQ("<div>").addClass("b2c-chooser-headline").text("1. Choose a username field");
	$description.append($h1);

	var $btnDismiss = cIPJQ("<button>").text("Dismiss").attr("id", "b2c-btn-dismiss")
		.addClass("b2c-btn").addClass("b2c-btn-danger")
		.click(function(e) {
			cIPJQ("div#b2c-backdrop").remove();
			cIPJQ("div#b2c-choose-fields").remove();
		});
	var $btnAgain = cIPJQ("<button>").text("Again").attr("id", "b2c-btn-again")
		.addClass("b2c-btn").addClass("b2c-btn-warning")
		.css("margin-right", "5px")
		.click(function(e) {
			cIPJQ(this).hide();
			cIPJQ("button#b2c-btn-confirm").hide();
			cIPJQ("div.b2c-fixed-field", cIPJQ("div#b2c-choose-fields")).remove();
			cIPJQ("div:first", cIPJQ("div#b2c-choose-description")).text("1. Choose a username field");
			chooserMarkAllUsernameFields(cIPJQ("#b2c-choose-fields"));
		})
		.hide();
	var $btnConfirm = cIPJQ("<button>").text("Confirm").attr("id", "b2c-btn-confirm")
		.addClass("b2c-btn").addClass("b2c-btn-primary")
		.css("margin-right", "15px")
		.click(function(e) {
			if(!_settings["defined-credential-fields"]) {
				_settings["defined-credential-fields"] = {};
			}
			_settings["defined-credential-fields"][document.location.origin] = {
				"username": _prepareId(cIPJQ("div#b2c-choose-fields").data("username")),
				"password": _prepareId(cIPJQ("div#b2c-choose-fields").data("password"))
			};

			chrome.extension.sendMessage({
				action: 'save_settings',
				args: [_settings]
			});

			cIPJQ("button#b2c-btn-dismiss").click();
		})
		.hide();

	$description.append($btnConfirm);
	$description.append($btnAgain);
	$description.append($btnDismiss);

	if(_settings["defined-credential-fields"] && _settings["defined-credential-fields"][document.location.origin]) {
		var $p = cIPJQ("<p>").html("For this page credential fields are already selected.<br />");
		var $btnDiscard = cIPJQ("<button>")
			.attr("id", "b2c-btn-discard")
			.text("Discard selection")
			.css("margin-top", "5px")
			.addClass("b2c-btn")
			.addClass("b2c-btn-small")
			.addClass("b2c-btn-danger")
			.click(function(e) {
				delete _settings["defined-credential-fields"][document.location.origin];

				chrome.extension.sendMessage({
					action: 'save_settings',
					args: [_settings]
				});

				chrome.extension.sendMessage({
					action: 'load_settings'
				});

				cIPJQ(this).parent("p").remove();
			});
		$p.append($btnDiscard);
		$description.append($p);
	}

	cIPJQ("div#b2c-backdrop").draggit("div#b2c-choose-description");
}

function chooserMarkAllPasswordFields($chooser) {
	cIPJQ("input[type='password']").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			var $field = cIPJQ("<div>").addClass("b2c-fixed-field")
				.css("top", cIPJQ(this).offset().top)
				.css("left", cIPJQ(this).offset().left)
				.css("width", cIPJQ(this).outerWidth())
				.css("height", cIPJQ(this).outerHeight())
				.data("id", cIPJQ(this).attr("id"))
				.click(function(e) {
					cIPJQ("div#b2c-choose-fields").data("password", cIPJQ(this).data("id"));
					cIPJQ(this).addClass("b2c-fixed-password-field").text("Password").unbind("click");
					cIPJQ("div.b2c-fixed-field:not(.b2c-fixed-password-field,.b2c-fixed-username-field)", cIPJQ("div#b2c-choose-fields")).remove();
					cIPJQ("button#b2c-btn-confirm").show();
					cIPJQ("div:first", cIPJQ("div#b2c-choose-description")).text("3. Confirm selection");
				})
				.hover(function() {cIPJQ(this).addClass("b2c-fixed-hover-field");}, function() {cIPJQ(this).removeClass("b2c-fixed-hover-field");});
			$chooser.append($field);
		}
	});
}

function chooserMarkAllUsernameFields($chooser) {
	cIPJQ("input[type='text'], input[type='email'], input:not([type])").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			var $field = cIPJQ("<div>").addClass("b2c-fixed-field")
				.css("top", cIPJQ(this).offset().top)
				.css("left", cIPJQ(this).offset().left)
				.css("width", cIPJQ(this).outerWidth())
				.css("height", cIPJQ(this).outerHeight())
				.data("id", cIPJQ(this).attr("id"))
				.click(function(e) {
					cIPJQ("div#b2c-choose-fields").data("username", cIPJQ(this).data("id"));
					cIPJQ(this).addClass("b2c-fixed-username-field").text("Username").unbind("click");
					cIPJQ("div.b2c-fixed-field:not(.b2c-fixed-username-field)", cIPJQ("div#b2c-choose-fields")).remove();
					cIPJQ("div:first", cIPJQ("div#b2c-choose-description")).text("2. Now choose a password field");
					cIPJQ("button#b2c-btn-again").show();
					chooserMarkAllPasswordFields(cIPJQ("#b2c-choose-fields"));
				})
				.hover(function() {cIPJQ(this).addClass("b2c-fixed-hover-field");}, function() {cIPJQ(this).removeClass("b2c-fixed-hover-field");});
			$chooser.append($field);
		}
	});
}

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
		passwordField = cIPJQ("input[type='password']:first", form[0]);
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
			if(credentialInputs[i].password == passwordField.attr("id")) {
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
		chrome.extension.sendMessage({
			'action': 'popup_login',
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
	chrome.extension.sendMessage({
		'action': 'popup_login',
		'args': [usernames]
	});

	// initialize autocomplete for username fields
	if(_settings.autoCompleteUsernames) {
		for(var i = 0; i < credentialInputs.length; i++) {
			if(_f(credentialInputs[i].username)) {
				if(_f(credentialInputs[i].username).hasClass("ui-autocomplete-input")) {
					//_f(credentialInputs[i].username).autocomplete("source", autocompleteSource);
					_f(credentialInputs[i].username).autocomplete("destroy");
				}
				_f(credentialInputs[i].username)
				.autocomplete({
					minLength: 0,
					source: autocompleteSource,
					select: autocompleteSelect,
					open: autocompleteOpen
				})
				.focus(autocompleteFocus)
				.click(function() {
					cIPJQ(this).autocomplete( "search", cIPJQ(this).val());
				});

				_f(credentialInputs[i].username)
				.blur(autocompleteBlur)
				.focus(function() {
					_u = cIPJQ(this);
				});
			}
		}
	}
}

function autocompleteOpen(event, ui) {
	// NOT BEAUTIFUL!
	// modifies ALL ui-autocomplete menus, also those which aren't from us
	// TODO: find a way to get the corresponding dropdown menu to a login field
	cIPJQ("ul.ui-autocomplete.ui-menu").css("z-index", 10000);
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

	//setUniqueId(field);

	var fields = {
		"username": null,
		"password": null
	};

	if(type == "username") {
		var passwordField = getPasswordFieldFromUsernameField(field, true);
		setUniqueId(field);
		setUniqueId(passwordField);
		fields = {
			"username": _prepareId(field.attr("id")),
			"password": _prepareId(passwordField.attr("id"))
		};
	}
	else if(type == "password") {
		var usernameField = getUsernameFieldFromPasswordField(field, true);
		setUniqueId(field);
		setUniqueId(usernameField);
		fields = {
			"username": _prepareId(usernameField.attr("id")),
			"password": _prepareId(field.attr("id"))
		};
	}

	if(fields.username) {
		credentialInputs.push(fields);
		if(_credentials.logins.length > 0) {
			_preparePageForMultipleCredentials(_credentials.logins);
		}
	}

	return fields;
}


function fillInCredentials(credentialFields, onlyPassword, suppressWarnings) {
	var form = (_f(credentialFields.username)) ? _f(credentialFields.username).closest("form") : _f(credentialFields.password).closest("form");
	var action = null;

	var u = _f(credentialFields.username);
	var p = _f(credentialFields.password);

	if(u) {
		_u = u;
	}
	if(p) {
		_p = p;
	}

	if(form && form.length > 0) {
		action = form[0].action;
	}

	if (typeof(action) != "string" || action == "") {
		action = document.location.origin + document.location.pathname;
	}

	if(_credentials.url == document.location.origin && _credentials.submiturl == action && _credentials.logins.length > 0) {
		_fillIn(credentialFields, onlyPassword, suppressWarnings);
	}
	else {
		_credentials.url = document.location.origin;
		_credentials.submiturl = action;

		chrome.extension.sendMessage({
			'action': 'retrieve_credentials',
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
		chrome.extension.sendMessage({
			action: 'alert',
			args: [message]
		});
		return;
	}

	fillInCredentials(credentialFields, true, suppressWarnings);
}

function _prepareId(id) {
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

function _f(fieldId) {
	return cIPJQ("#"+fieldId);
}

function _fillIn(credentialFields, onlyPassword, suppressWarnings) {
	// no credentials available
	if (_credentials.logins.length == 0 && !suppressWarnings) {
		var message = "No logins found.";
		chrome.extension.sendMessage({
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
					else if(!onlyPassword) {
						countPasswords += 1;
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
				"press the chromeIPass icon for more options";
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

function _clearCredentials() {
	_credentials.logins = [];
	autocompleteElements = [];

	if(_settings.autoCompleteUsernames) {
		for(var i = 0; i < credentialInputs.length; i++) {
			if(_f(credentialInputs[i].username)) {
				if(_f(credentialInputs[i].username).hasClass("ui-autocomplete-input")) {
					//_f(credentialInputs[i].username).autocomplete("destroy");
				}
			}
		}
	}
}

function _triggerActivatedTab() {
	// initCredentialFields calls also "retrieve_credentials", to prevent it
	// check of init() was already called
	var called = _calledInitCredentialFields;
	// doesn't run a second time because of _calledInitCredentialFields set to true
	init();

	if(called && (_credentials.url || _credentials.submiturl)) {
		chrome.extension.sendMessage({
			'action': 'retrieve_credentials',
			'args': [ _credentials.url, _credentials.submiturl ]
		}, function(logins) {
			_logins_callback(logins);
		});
	}
}