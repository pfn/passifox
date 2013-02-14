(function() {
var inputs = document.getElementsByTagName("input");
var passwordinputs = [];
var usernameinputs = [];
var availableUsernames = [];

function visible(e) {
    var visible = true;
    var p = e;
    while (p && p.tagName.toLowerCase() != "body" && visible) {
        var style = window.getComputedStyle(p);
        visible = style.display != "none" && style.visibility != "hidden" &&
                style.visibility != "collapsed";
        p = p.parentNode;
    }
    return visible;
}

for (var i = 0; i < inputs.length; i++) {
    var input = inputs.item(i);
    if (input.hasAttribute("type")) {
        var type = input.getAttribute("type").toLowerCase();
        if (type == "password" && !input.hasAttribute("disabled") &&
                visible(input))
            passwordinputs.push(input);
    }
}

function getFields(u, p) {
    var form = u != null ? u.form : p.form;
    var input = null;
    if (!form) {
        if (!p)
            return [u,p];
        var lastinput;
        for (var i = 0; i < inputs.length && !u; i++) {
            if (inputs[i] == p) {
                u = lastinput;
            } else {
                if (!inputs[i].hasAttribute("type") ||
                        inputs[i].getAttribute("type").toLowerCase()== "text" ||
                        inputs[i].getAttribute("type").toLowerCase() == "email")
                    lastinput = inputs[i];
            }
        }
        return [u,p];
    }
    for (var i = 0; i < form.elements.length; i++) {
        var e = form.elements[i];
        if (e.tagName.toLowerCase() == "input") {
            var etype = e.type.toLowerCase();
            if (u != null && u !== e && etype == "password") {
                p = e;
                break;
            }
            if (etype == "text" || etype == "email")
                input = e;
            if ((p != null && p == e)) {
                u = input;
                break;
            }
        }
    }
    return [u,p];
}

var _logins = null;
var _u = null;
var _p = null;
function logins_callback(logins) {
    var u = getFields(null, passwordinputs[0])[0];
    if (u)
        u.setAttribute("autocomplete", "off");
    if (logins.length == 1) {
        if (u)
            u.value = logins[0].Login;
        passwordinputs[0].value = logins[0].Password;
    } else if (logins.length > 1) {
        var usernames = [];
		availableUsernames = [];
        for (var i = 0; i < logins.length; i++) {
            usernames.push(logins[i].Name + " - " + logins[i].Login);
			var item = { "label": logins[i].Login + " (" + logins[i].Name + ")", "value": logins[i].Login };
			availableUsernames.push(item);
			//availableUsernames.push(logins[i].Login);
        }

        chrome.extension.sendRequest({
            'action': 'select_login',
            'args': [usernames]
        });
        _logins = logins;
        _u = u;
    }
}
function fillLogin(u, p, onlyPassword, suppressWarnings) {
    var form = u != null ? u.form : p.form;
    var action = document.location.origin;
    if (form)
        action = form.action;
    chrome.extension.sendRequest({
        'action': 'get_passwords',
        'args': [ document.location.origin, action ]
    }, function(logins) {
		if (logins.length == 0 && !suppressWarnings) {
            var message = "No logins found";
            chrome.extension.sendRequest({ action: 'alert', args: [message] });
            return;
        }
        if (logins.length == 1) {
            if (u && !onlyPassword)
                u.value = logins[0].Login;
            if (p) {
                p.value = logins[0].Password;
				cIPJQ(p).data("unchanged", true);
			}
        } else {
			// check if password for given username exists
			var found = false;

			if(u) {
				var valPassword = "";
				var countPassword = 0;
				for (var i = 0; i < logins.length; i++) {
					if(logins[i].Login == u.value) {
						countPassword += 1;
						valPassword = logins[i].Password;
					}
				}

				if(countPassword == 1) {
					if(p) {
						p.value = valPassword;
						cIPJQ(p).data("unchanged", true);
					}
					found = true;
				}
			}

			_u = u;
			_p = p;
			_logins = logins;
			var usernames = [];
			for (var i = 0; i < logins.length; i++) {
				usernames.push(logins[i].Name + " - " + logins[i].Login);
			}
			chrome.extension.sendRequest({
				'action': 'select_login',
				'args': [usernames, true]
			});

			if(!found) {
				if(!suppressWarnings) {
					var message = "More than one login was found in KeePass, " +
							"press the ChromeIPass icon for more options";
					chrome.extension.sendRequest({ action: 'alert', args: [message] });
				}
			}
        }
    });
}

window.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey) {
        if (e.keyCode == 80) { // P
            fillInPassOnly();
        } else if (e.keyCode == 85) { // U
            fillInUserPass();
        }
    }
}, false);
function fillInUserPass(suppressWarnings) {
    var u = document.activeElement;
    if (u.tagName.toLowerCase() != "input")
        return;
	var p = null;
	if(u.type.toLowerCase() == "password") {
		p = u;
		u = getFields(null, p)[0];
	}
	else {
		p = getFields(u, null)[1];
	}
    fillLogin(u, p, false, suppressWarnings);
}
function fillInPassOnly(suppressWarnings) {
    var p = document.activeElement;
    if (p.tagName.toLowerCase() != "input")
        return;
    if (p.type.toLowerCase() != "password")
        p = getFields(p, null)[1];
    if (!p) {
        var message = "Unable to find a password field";
        chrome.extension.sendRequest({
            action: 'alert',
            args: [message]
        });
        return;
    }

	var u = _u;
	if(!_u) {
		u = getFields(null, p)[0];
	}

	var onlyPassword = (u && u.value != "");

    fillLogin(u, p, onlyPassword, suppressWarnings);
}
chrome.extension.onRequest.addListener(function onRequest(req) {
    if ('id' in req) {
        if (_u)
            _u.value = _logins[req.id].Login;
        if (_p)
            _p.value = _logins[req.id].Password;
        // wish I could clear out _logins and _u, but a subsequent
        // selection may be requested.
    }
    if ('action' in req) {
        if (req.action == "fill_user_pass") {
            fillInUserPass();
        } else if (req.action == "fill_pass_only") {
            fillInPassOnly();
        }
    }
});


// add lost focus listener to all possible username fields
for(var i = 0; i < passwordinputs.length; i++) {
	u = getFields(null, passwordinputs[i])[0];
	usernameinputs.push(u);

	cIPJQ(passwordinputs[i]).change(function(e) {
		cIPJQ(this).data("unchanged", false);
	});

	if(u) {
		cIPJQ(u).autocomplete({
			minLength: 0,
			source: function( request, response ) {
				var matches = cIPJQ.map( availableUsernames, function(tag) {
					if ( tag.label.toUpperCase().indexOf(request.term.toUpperCase()) === 0 ) {
						return tag;
					}
				});
				response(matches);
			},
			select: function(e, ui) {
				e.preventDefault();
				cIPJQ(this).val(ui.item.value);
				fillLogin(cIPJQ(this)[0], getFields(cIPJQ(this)[0], null)[1], true, false);
				cIPJQ(this).data("fetched", true);
			}
		})
		.blur(function(e) {
			if(cIPJQ(this).data("fetched") == true) {
				cIPJQ(this).data("fetched", false);
			}
			else {
				var p = getFields(cIPJQ(this)[0], null)[1];
				if(cIPJQ(p).data("unchanged") != true) {
					fillLogin(cIPJQ(this)[0], p, true, true);
				}
			}
		})
		.focus(function(e) {
			if(cIPJQ(this).val() == "") {
				cIPJQ(this).autocomplete( "search", "" );
				//cIPJQ(this).trigger("keydown");
			}
		});
	}
}

if (passwordinputs.length == 0) {
    chrome.extension.sendRequest({
        'action': 'hide_actions'
    });
} else if (passwordinputs.length == 1) {
    _p = passwordinputs[0];
    var action = document.location.origin;
    if (_p.form)
        action = _p.form.action;
    if (typeof(action) != "string") {
        // potential security issue if the real form action points elsewhere
        action = document.location.origin;
    }
    chrome.extension.sendRequest({
        'action': 'get_passwords',
        'args': [ document.location.origin, action ]
    }, logins_callback);
} else if (passwordinputs.length > 1) {
    chrome.extension.sendRequest({
        'action': 'select_field'
    });
}

})();
