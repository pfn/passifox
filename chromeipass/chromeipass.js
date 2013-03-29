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
		else if (req.action == "activate_password_generator") {
			cip.initPasswordGenerator(cipFields.getAllFields());
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
	var field = (fieldId) ? cIPJQ("input[data-cip-id='"+fieldId+"']:first") : [];
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
		});
	field
		.click(cipAutocomplete.onClick)
		.blur(cipAutocomplete.onBlur)
		.focus(cipAutocomplete.onFocus);
}

cipAutocomplete.onClick = function() {
	cIPJQ(this).autocomplete( "search", cIPJQ(this).val());
}

cipAutocomplete.onOpen = function(event, ui) {
	// NOT BEAUTIFUL!
	// modifies ALL ui-autocomplete menus, also those which aren't from us
	// TODO: find a way to get the corresponding dropdown menu to a login field
	cIPJQ("ul.cip-ui-autocomplete.cip-ui-menu").css("z-index", 2147483646);
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
	var fieldId = cipFields.prepareId(cIPJQ(this).attr("data-cip-id"));
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
		var fieldId = cipFields.prepareId(cIPJQ(this).attr("data-cip-id"));
		var fields = cipFields.getCombination("username", fieldId);
		if(_f(fields.password) && _f(fields.password).data("unchanged") != true) {
			cip.fillInCredentials(fields, true, true);
		}
	}
}

cipAutocomplete.onFocus = function() {
	cip.u = cIPJQ(this);

	if(cIPJQ(this).val() == "") {
		cIPJQ(this).autocomplete("search", "");
	}
}



var cipPassword = {};

cipPassword.observedIcons = [];
cipPassword.observingLock = false;

cipPassword.init = function() {
	if("initPasswordGenerator" in _called) {
		return;
	}

	_called.initPasswordGenerator = true;

	window.setInterval(function() {
		cipPassword.checkObservedElements();
	}, 400);
}

cipPassword.initField = function(field, inputs, pos) {
	if(!field || field.length != 1) {
		return;
	}
	if(field.data("cip-password-generator")) {
		return;
	}

	field.data("cip-password-generator", true);

	cipPassword.createIcon(field);
	cipPassword.createDialog();

	var $found = false;
	if(inputs) {
		for(var i = pos + 1; i < inputs.length; i++) {
			if(inputs[i] && inputs[i].attr("type") && inputs[i].attr("type").toLowerCase() == "password") {
				field.data("cip-genpw-next-field-id", inputs[i].data("cip-id"));
				field.data("cip-genpw-next-is-password-field", (i == 0));
				$found = true;
				break;
			}
		}
	}

	field.data("cip-genpw-next-field-exists", $found);
}

cipPassword.createDialog = function() {
	if("passwordCreateDialog" in _called) {
		return;
	}

	_called.passwordCreateDialog = true;

	var $dialog = cIPJQ("<div>")
		.attr("id", "cip-genpw-dialog");

	var $divFloat = cIPJQ("<div>").addClass("cip-genpw-clearfix");
	var $btnGenerate = cIPJQ("<button>")
		.text("Generate")
		.attr("id", "cip-genpw-btn-generate")
		.addClass("b2c-btn")
		.addClass("b2c-btn-primary")
		.addClass("b2c-btn-small")
		.css("float", "left")
		.click(function(e) {
			e.preventDefault();
			chrome.extension.sendMessage({
				action: "generate_password"
			}, cipPassword.callbackGeneratedPassword);
		});
	$divFloat.append($btnGenerate);

	var $btnClipboard = cIPJQ("<button>")
		.text("Copy to clipboard")
		.attr("id", "cip-genpw-btn-clipboard")
		.addClass("b2c-btn")
		.addClass("b2c-btn-small")
		.css("float", "right")
		.click(function(e) {
			e.preventDefault();

			chrome.extension.sendMessage({
				action: "copy_password",
				args: [cIPJQ("input#cip-genpw-textfield-password").val()]
			}, cipPassword.callbackPasswordCopied);
		});
	$divFloat.append($btnClipboard);

	$dialog.append($divFloat);

	var $textfieldPassword = cIPJQ("<input>")
		.attr("id", "cip-genpw-textfield-password")
		.attr("type", "text")
		.addClass("cip-genpw-textfield")
		.on('change keypress paste textInput input', function() {
			cIPJQ("#cip-genpw-btn-clipboard:first").removeClass("b2c-btn-success");
		});
	$dialog.append($textfieldPassword);

	var $checkboxNextField = cIPJQ("<input>")
		.attr("id", "cip-genpw-checkbox-next-field")
		.attr("type", "checkbox")
		.addClass("cip-genpw-checkbox");
	var $labelNextField = cIPJQ("<label>")
		.append($checkboxNextField)
		.addClass("cip-genpw-label")
		.append(" also fill in the next password-field");
	$dialog.append($labelNextField);

	var $btnFillIn = cIPJQ("<button>")
		.text("Fill in & copy to clipboard")
		.attr("id", "cip-genpw-btn-fillin")
		.addClass("b2c-btn")
		.addClass("b2c-btn-small")
		.click(function(e) {
			e.preventDefault();

			var fieldId = cIPJQ("#cip-genpw-dialog:first").data("cip-genpw-field-id");
			var field = cIPJQ("input[data-cip-id='"+fieldId+"']:first");
			if(field.length == 1) {
				var $password = cIPJQ("input#cip-genpw-textfield-password:first").val();

				if(field.attr("maxlength")) {
					if($password.length > field.attr("maxlength")) {
						$password = $password.substring(0, field.attr("maxlength"));
						cIPJQ("input#cip-genpw-textfield-password:first").val($password);
						cIPJQ("#cip-genpw-btn-clipboard:first").removeClass("b2c-btn-success");
						alert("The generated password is longer than the allowed length!\nIt has been cut to fit the length.\n\nPlease remember the new password!");
					}
				}

				field.val($password);
				if(cIPJQ("input#cip-genpw-checkbox-next-field:checked").length == 1) {
					if(field.data("cip-genpw-next-field-exists")) {
						var nextFieldId = field.data("cip-genpw-next-field-id");
						var nextField = cIPJQ("input[data-cip-id='"+nextFieldId+"']:first");
						if(nextField.length == 1) {
							nextField.val($password);
						}
					}
				}

				// copy password to clipboard
				chrome.extension.sendMessage({
					action: "copy_password",
					args: [$password]
				}, cipPassword.callbackPasswordCopied);
			}
		});
	$dialog.append($btnFillIn);

	$dialog.hide();
	cIPJQ("body").append($dialog);
	$dialog.dialog({
		closeText: "×",
		autoOpen: false,
		modal: true,
		resizable: false,
		minWidth: 340,
		title: "Generate new password",
		open: function(event, ui) {
			cIPJQ(".cip-ui-widget-overlay").click(function() {
				cIPJQ("#cip-genpw-dialog:first").dialog("close");
			});

			if(cIPJQ("input#cip-genpw-textfield-password:first").val() == "") {
				cIPJQ("button#cip-genpw-btn-generate:first").click();
			}
		}
	});
}

cipPassword.createIcon = function(field) {
	var $className = (field.outerHeight() > 28) ? "cip-icon-key-big" : "cip-icon-key-small";
	var $size = (field.outerHeight() > 28) ? 24 : 16;
	var $offset = Math.floor((field.outerHeight() - $size) / 3);
	$offset = ($offset < 0) ? 0 : $offset;

	var $zIndex = 0;
	var $zIndexField = field;
	while($zIndexField.css("z-index") == "auto") {
		if($zIndexField == $zIndexField.parent()) {
			break;
		}
		$zIndexField = $zIndexField.parent();
	}
	$zIndex = $zIndexField.css("z-index");

	if(isNaN($zIndex) || $zIndex < 1) {
		$zIndex = 1;
	}

	var $icon = cIPJQ("<div>").addClass("cip-genpw-icon")
		.addClass($className)
		.css("z-index", $zIndex)
		.css("top", field.offset().top + $offset + 1)
		.css("left", field.offset().left + field.outerWidth() - $size - $offset)
		.data("cip-genpw-field-id", field.data("cip-id"));
	$icon.click(function(e) {
		e.preventDefault();

		if(!field.is(":visible")) {
			$icon.remove();
			field.removeData("cip-password-generator");
			return;
		}

		var $dialog = cIPJQ("#cip-genpw-dialog");
		if($dialog.dialog("isOpen")) {
			$dialog.dialog("close");
		}
		$dialog.dialog("option", "position", { my: "left-10px top", at: "center bottom", of: cIPJQ(this) });
		$dialog.data("cip-genpw-field-id", field.data("cip-id"));
		$dialog.data("cip-genpw-next-field-id", field.data("cip-genpw-next-field-id"));
		$dialog.data("cip-genpw-next-is-password-field", field.data("cip-genpw-next-is-password-field"));

		var $bool = Boolean(field.data("cip-genpw-next-field-exists"));
		cIPJQ("input#cip-genpw-checkbox-next-field:first")
			.attr("checked", $bool)
			.attr("disabled", !$bool);

		$dialog.dialog("open");
	});

	cipPassword.observedIcons.push($icon);

	cIPJQ("body").append($icon);
}

cipPassword.callbackPasswordCopied = function(bool) {
	if(bool) {
		cIPJQ("#cip-genpw-btn-clipboard").addClass("b2c-btn-success");
	}
}

cipPassword.callbackGeneratedPassword = function(entries) {
	if(entries && entries.length >= 1) {
		cIPJQ("#cip-genpw-btn-clipboard:first").removeClass("b2c-btn-success");
		cIPJQ("input#cip-genpw-textfield-password:first").val(entries[0].Password);
	}
	else {
		if(cIPJQ("div#cip-genpw-error:first").length == 0) {
			cIPJQ("button#cip-genpw-btn-generate:first").after("<div style='block' id='cip-genpw-error'>Cannot receive generated password.<br />Is your version of KeePassHttp up-to-date?<br /><br /><a href='https://github.com/pfn/keepasshttp/'>Please visit the KeePassHttp homepage</a></div>");
			cIPJQ("input#cip-genpw-textfield-password:first").hide();
			cIPJQ("input#cip-genpw-checkbox-next-field:first").parent("label").hide();
			cIPJQ("button#cip-genpw-btn-generate").hide();
			cIPJQ("button#cip-genpw-btn-clipboard").hide();
			cIPJQ("button#cip-genpw-btn-fillin").hide();
		}
	}
}

cipPassword.onRequestPassword = function() {
	chrome.extension.sendMessage({
		'action': 'generate_password'
	}, cipPassword.callbackGeneratedPassword);
}

cipPassword.checkObservedElements = function() {
	if(cipPassword.observingLock) {
		return;
	}

	cipPassword.observingLock = true;
	cIPJQ.each(cipPassword.observedIcons, function(index, iconField) {
		if(iconField && iconField.length == 1) {
			var fieldId = iconField.data("cip-genpw-field-id");
			var field = cIPJQ("input[data-cip-id='"+fieldId+"']:first");
			if(!field || field.length != 1) {
				iconField.remove();
				cipPassword.observedIcons.splice(index, 1);
			}
			else if(!field.is(":visible")) {
				iconField.remove();
				field.removeData("cip-password-generator");
			}
		}
		else {
			cipPassword.observedIcons.splice(index, 1);
		}
	});
	cipPassword.observingLock = false;
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

	cipDefine.initDescription();

	cipDefine.prepareStep1();
	cipDefine.markAllUsernameFields($chooser);
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

	cIPJQ("div#b2c-cipDefine-description").draggable();
}

cipDefine.markAllUsernameFields = function ($chooser) {
	cIPJQ("input[type='text'], input[type='email'], input:not([type])").each(function() {
		if(cIPJQ(this).is(":visible") && cIPJQ(this).css("visibility") != "hidden" && cIPJQ(this).css("visibility") != "collapsed") {
			var $field = cIPJQ("<div>").addClass("b2c-fixed-field")
				.css("top", cIPJQ(this).offset().top)
				.css("left", cIPJQ(this).offset().left)
				.css("width", cIPJQ(this).outerWidth())
				.css("height", cIPJQ(this).outerHeight())
				.attr("data-cip-id", cIPJQ(this).attr("data-cip-id"))
				.click(function(e) {
					cIPJQ("div#b2c-cipDefine-fields").data("username", cIPJQ(this).data("cip-id"));
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
				.attr("data-cip-id", cIPJQ(this).attr("data-cip-id"))
				.click(function(e) {
					cIPJQ("div#b2c-cipDefine-fields").data("password", cIPJQ(this).data("cip-id"));
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
// objects with combination of username + password fields
cipFields.combinations = [];

cipFields.setUniqueId = function(field) {
	if(field && !field.attr("data-cip-id")) {
		// use ID of field if it is unique
		// yes, it should be, but there are many bad developers outside...
		var fieldId = field.attr("id");
		if(fieldId) {
			var foundIds = cIPJQ("input#" + cipFields.prepareId(fieldId));
			if(foundIds.length == 1) {
				field.attr("data-cip-id", fieldId);
				return;
			}
		}

		// create own ID if no ID is set for this field
		cipFields.uniqueNumber += 1;
		field.attr("data-cip-id", "cIPJQ"+String(cipFields.uniqueNumber));
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

		if(inputs[i].attr("type") && inputs[i].attr("type").toLowerCase() == "password") {
			var uId = (!uField || uField.length < 1) ? null : cipFields.prepareId(uField.attr("data-cip-id"));

			var combination = {
				"username": uId,
				"password": cipFields.prepareId(inputs[i].attr("data-cip-id"))
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
			passwordId = cipFields.prepareId(passwordField.attr("data-cip-id"));
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
			usernameId = cipFields.prepareId(usernameField.attr("data-cip-id"));
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
			if(cIPJQ(this).attr("data-cip-id") == passwordId) {
				// break
				return false;
			}

			if(cIPJQ(this).attr("type") && cIPJQ(this).attr("type").toLowerCase() == "password") {
				// continue
				return true;
			}

			usernameField = cIPJQ(this);
		});
	}
	// search all inputs on page
	else {
		var inputs = cipFields.getAllFields();
		cip.initPasswordGenerator(inputs);
		for(var i = 0; i < inputs.length; i++) {
			if(inputs[i].attr("data-cip-id") == passwordId) {
				break;
			}

			if(inputs[i].attr("type") && inputs[i].attr("type").toLowerCase() == "password") {
				continue;
			}

			usernameField = inputs[i];
		}
	}

	if(usernameField && !checkDisabled) {
		var usernameId = usernameField.attr("data-cip-id");
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

		if(cip.settings.usePasswordGenerator) {
			cipPassword.init();
			cipPassword.initField(passwordField);
		}
	}
	// search all inputs on page
	else {
		var inputs = cipFields.getAllFields();
		cip.initPasswordGenerator(inputs);

		var active = false;
		for(var i = 0; i < inputs.length; i++) {
			if(inputs[i].attr("data-cip-id") == usernameId) {
				active = true;
			}
			if(active && cIPJQ(inputs[i]).attr("type") && cIPJQ(inputs[i]).attr("type").toLowerCase() == "password") {
				passwordField = inputs[i];
				break;
			}
		}
	}

	if(passwordField && !checkDisabled) {
		var passwordId = passwordField.attr("data-cip-id");
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

	var inputs = cipFields.getAllFields();
	cip.initPasswordGenerator(inputs);

	if(!cipFields.useDefinedCredentialFields()) {
		// get all combinations of username + password fields
		cipFields.combinations = cipFields.getAllCombinations(inputs);
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

cip.initPasswordGenerator = function(inputs) {
	if(cip.settings.usePasswordGenerator) {
		cipPassword.init();

		for(var i = 0; i < inputs.length; i++) {
			if(inputs[i] && inputs[i].attr("type") && inputs[i].attr("type").toLowerCase() == "password") {
				cipPassword.initField(inputs[i], inputs, i);
			}
		}
	}
}

cip.retrieveCredentialsCallback = function (credentials, dontAutoFillIn) {
	if (cipFields.combinations.length > 0) {
		cip.u = _f(cipFields.combinations[0].username);
		cip.p = _f(cipFields.combinations[0].password);
	}

	if (credentials.length > 0) {
		cip.credentials = credentials;
		cip.prepareFieldsForCredentials(!Boolean(dontAutoFillIn));
	}
}

cip.prepareFieldsForCredentials = function(autoFillInForSingle) {
	// only one login for this site
	if (autoFillInForSingle && cip.credentials.length == 1) {
		if(cip.u) {
			cip.u.val(cip.credentials[0].Login);
		}
		if(cip.p) {
			cip.p.val(cip.credentials[0].Password);
		}

		// generate popup-list of usernames + descriptions
		chrome.extension.sendMessage({
			'action': 'popup_login',
			'args': [[cip.credentials[0].Login + " (" + cip.credentials[0].Name + ")"]]
		});
	}
	//multiple logins for this site
	else if (cip.credentials.length > 1 || (!autoFillInForSingle && cip.credentials.length > 0)) {
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
			cip.retrieveCredentialsCallback(credentials, true);
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
	var fieldId = cipFields.prepareId(cIPJQ(el).attr("data-cip-id"));
	var combination = null;
	if(el.type && el.type.toLowerCase() == "password") {
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
	var fieldId = cipFields.prepareId(cIPJQ(el).attr("data-cip-id"));
	var combination = null;
	if(el.type && el.type.toLowerCase() == "password") {
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
			_f(combination.password).attr("type", "password");
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
			// find passwords to given username (even those with empty username)
			else {
				for (var i = 0; i < cip.credentials.length; i++) {
					if(cip.credentials[i].Login == valUsername) {
						countPasswords += 1;
						valPassword = cip.credentials[i].Password;
					}
				}

				if(countPasswords == 0) {
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