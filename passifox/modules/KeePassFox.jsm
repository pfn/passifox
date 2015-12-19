let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://services-crypto/WeaveCrypto.js");

let AES_KEY_URL = "chrome://passifox";

let KEEPASSFOX_CACHE_TIME = 30 * 1000; // milliseconds

let EXPORTED_SYMBOLS = [ "KeePassFox" ];
function KeePassFox() {
    XPCOMUtils.defineLazyGetter(this, "_mozStorage", function() {
        let contract = "@mozilla.org/login-manager/storage/mozStorage;1";
        let storage;
        if (typeof Cc[contract] == 'undefined') {
            contract = "@mozilla.org/login-manager/storage/json;1";
            storage = Cc[contract].createInstance(Ci.nsILoginManagerStorage);
            storage.initialize();
        } else {
            storage = Cc[contract].createInstance(Ci.nsILoginManagerStorage);
            storage.init();
        }
        return storage;
    });
    XPCOMUtils.defineLazyGetter(this, "_crypto", function() {
        return new WeaveCrypto();
    });

    this._prefBranch = Services.prefs.getBranch("signon.");
    this._myPrefs = Services.prefs.getBranch("extensions.passifox.");
    this._myNotifyPrefs = Services.prefs.getBranch("extensions.passifox.notification.");
    let kpf = this;
    this._observer = {
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                               Ci.nsISupportsWeakReference]),
        observe: function(subject, topic, data) {
            kpf._debug = kpf._prefBranch.getBoolPref("debug");
            kpf.log("debug pref updated: " + kpf._debug);
            kpf._keepassHttpUrl = kpf._myPrefs.getCharPref("keepasshttp_url");
            kpf.log("keepassHttpUrl updated" + kpf._keepassHttpUrl);
        }
    };
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this._prefBranch.addObserver("debug", this._observer, false);
    this._debug = this._prefBranch.getBoolPref("debug");

    this._keepassHttpUrl = this._myPrefs.getCharPref("keepasshttp_url");
    this._myPrefs.QueryInterface(Ci.nsIPrefBranch2);
    this._myPrefs.addObserver("keepasshttp_url", this._observer, false);
}

KeePassFox.reload = function() {
    Services.console.logStringMessage("Reloading KeePassFox module");
    let l = Cc['@mozilla.org/moz/jssubscript-loader;1']
               .getService(Ci.mozIJSSubScriptLoader);
    l.loadSubScript("resource://passifox/modules/KeePassFox.jsm");
};

KeePassFox.prototype = {
    _associated: false,
    log: function(m) {
        if (!this._debug)
            return;
        Services.console.logStringMessage("KeePassFox: " + m);
    },
    _cache: { }, // use a cache to throttle get_logins requests
    _set_crypto_key: function(id, key) {
        let storage = this._mozStorage;
        let logins = storage.findLogins({}, AES_KEY_URL, null, null);
        for (let i = 0; i < logins.length; i++) {
            storage.removeLogin(logins[i]);
        }
        this.log("Storing key in mozStorage");
        let l = Cc['@mozilla.org/login-manager/loginInfo;1']
                .createInstance(Ci.nsILoginInfo);
        l.init(AES_KEY_URL, null, null, id, key, "", "");
        storage.addLogin(l);
    },
    _find_cache_item: function(url, submiturl, realm) {
        let key = url + "!!" + submiturl + "!!" + realm;
        let item = this._cache[key];
        let now = Date.now();
        if (item && (item.ts + KEEPASSFOX_CACHE_TIME) > now) {
            item.ts = now;
            return item.entries;
        }
        return null;
    },
    _cache_item: function(url, submiturl, realm, entries) {
        if (entries && entries.length == 0) return; // don't cache misses

        let key = url + "!!" + submiturl + "!!" + realm;
        if (!entries) {
            delete this._cache[key];
            return;
        }

        let item = {};
        item.ts = Date.now();
        item.entries = entries;
        this._cache[key] = item;
    },
    _prune_cache: function() {
        let now = Date.now();
        for (let i in this._cache) {
            let item = this._cache[i];
            if ((item.ts + KEEPASSFOX_CACHE_TIME) < now)
                delete this._cache[i];
        }
    },
    _clear_cache: function() {
        this._cache = {};
    },
    set_login: function(login) {
        if (!this._test_associate())
            return;
        let request = {
            RequestType: "set-login",
        };

        let [id, key] = this._set_verifier(request);
        let iv = request.Nonce;
        request.Login     = this._crypto.encrypt(login.username,  key, iv);
        request.Password  = this._crypto.encrypt(login.password,  key, iv);
        request.Url       = this._crypto.encrypt(login.url,       key, iv);

        if (login.submiturl)
            request.SubmitUrl = this._crypto.encrypt(login.submiturl, key, iv);
        if (login.uuid)
            request.Uuid      = this._crypto.encrypt(login.uuid, key, iv);
        if (login.realm)
            request.Realm     = this._crypto.encrypt(login.realm, key, iv);

        let [s, response, ready] = this._send(request);
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            if (this._verify_response(r, key, id)) {
                this.log("saved login for: " + login.url);
                // clear cache for this entry
                this._cache_item(login.url, login.submiturl, login.realm, null);
            } else {
                this._showNotification(
                        "set_login for " + login.url + " rejected");
            }
        }
    },
    get_logins: function(url, submiturl, force, realm) {
        let cached = this._find_cache_item(url, submiturl, realm);
        if (cached && !force)
            return cached;

        if (!this._test_associate())
            return [];

        let request = {
            RequestType: "get-logins",
        };
        let [id, key] = this._set_verifier(request);
        let iv = request.Nonce;
        request.Url = this._crypto.encrypt(url, key, iv);
        if (submiturl)
            request.SubmitUrl = this._crypto.encrypt(submiturl, key, iv);
        if (realm)
            request.Realm = this._crypto.encrypt(realm, key, iv);
        let [s, response, ready] = this._send(request);
        let entries = [];
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            if (this._verify_response(r, key, id)) {
                let iv = r.Nonce;
                for (let i = 0; i < r.Entries.length; i++) {
                    this._decrypt_entry(r.Entries[i], key, iv);
                }
                entries = r.Entries;
                this.log("Retrieved entries: " + JSON.stringify(entries));
                this._cache_item(url, submiturl, realm, entries);
            } else {
                this._cache_item(url, submiturl, realm, []);
                this.log("get_logins for " + url + " rejected");
            }
        }
        return entries;
    },
    get_logins_count: function(url) {
        this._prune_cache();
        if (!this._test_associate())
            return;
        let request = {
            RequestType: "get-logins-count",
        };
        let [id, key] = this._set_verifier(request);
        request.Url = this._crypto.encrypt(url, key, request.Nonce);
        let [s, response, ready] = this._send(request);
        let entries = [];
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            if (this._verify_response(r, key, id))
                return r.Count;
        }
        return 0;
    },
    get_all_logins: function() {
        if (!this._test_associate())
            return;
        let request = {
            RequestType: "get-all-logins",
        };
        let [id, key] = this._set_verifier(request);
        let [s, response, ready] = this._send(request);
        let entries = [];
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            if (!this._verify_response(r, key, id))
                return entries;
            let iv = r.Nonce;
            for (let i = 0; i < r.Entries.length; i++) {
                this._decrypt_entry(r.Entries[i], key, iv);
            }
            entries = r.Entries;
        }
        return entries;
    },

    _decrypt_entry: function(e, key, iv) {
        e.Login = this._crypto.decrypt(e.Login, key, iv);
        e.Uuid  = this._crypto.decrypt(e.Uuid,  key, iv);
        e.Name  = this._crypto.decrypt(e.Name,  key, iv);
        if (e.Password) {
            e.Password  = this._crypto.decrypt(e.Password,  key, iv);
        }
    },

    _get_crypto_key: function() {
        let storage = this._mozStorage;
        let l = storage.findLogins({}, AES_KEY_URL, null, null);
        let kpf = this;
        if (l.length == 0) {
            this._showNotification("KeePassFox has not been configured",
                    [{ accessKey: "c", label: "Connect",
                       callback: function(n, b) {
                           kpf._associate();
                       } }], "kpf-associate-note");
        }
        return l.length > 0 ? [l[0].username, l[0].password] : null;
    },
    _showNotification: function(m, buttons, id) {
        // check based on ID if user has allowed this notification to be shown
        if (this._myNotifyPrefs.getBoolPref(id) == true) {
            let win     = Services.wm.getMostRecentWindow("navigator:browser");
            if (id) {
                let notif = win.document.getElementById(id);
                if (notif)
                    return notif;
            }
            let browser = win.gBrowser;
            let box     = browser.getNotificationBox(browser.selectedBrowser);
            let n       = box.appendNotification(m, null,
                    "chrome://passifox/skin/keepass.png", 3, buttons);
            // let the notification show for configured amout of seconds
            n.timeout = Date.now() + this._myNotifyPrefs.getIntPref("timeout") * 1000;
            if (id)
                n.setAttribute("id", id);
            return n;
        }
    },
    _test_associate: function() {
        if (this._associated)
            return true;
        let request = {
                RequestType: "test-associate",
        };
        let info = this._set_verifier(request);
        if (!info)
            return false;

        let [id, key] = info;

        let [s, response, ready] = this._send(request);
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            if (!this._verify_response(r, key, id)) {
                let kpf = this;
                this._showNotification(
                        "KeePassFox encryption key is unrecognized",
                        [{ accessKey: "c", label: "Re-connect to KeePass",
                           callback: function(n, b) {
                               kpf._associate();
                         } }], "kpf-associate-note");
            }
        }
        return this._associated;
    },
    _associate: function() {
        if (this._associated)
            return;
        let key = this._crypto.generateRandomKey();
        let request = {
                RequestType: "associate",
                Key:         key,
        };
        this._set_verifier(request, key);
        let [s, response, ready] = this._send(request);
        if (this._success(s, ready)) {
            let r = JSON.parse(response);
            let id = r.Id;
            if (!this._verify_response(r, key)) {
                let kpf = this;
                this._showNotification("KeePass association failed",
                    [{ accessKey: "t", label: "Try Again",
                       callback: function(n, b) {
                           kpf._associate();
                       } }]);
                return;
            }
            this._set_crypto_key(id, key);
            this._showNotification("KeePassFox association completed");
            this._associated = true;
        }
    },
    _verify_response: function(response, key, id) {
        this._associated = response.Success;
        if (!response.Success)
            return false;
        let iv      = response.Nonce;
        let crypted = response.Verifier;
        let value   = this._crypto.decrypt(crypted, key, iv);

        this._associated = value == iv;
        if (id) {
            this._associated = this._associated && id == response.Id;
        }
        return this._associated;
    },
    _set_verifier: function(request, inkey) {
         let key = null;
         let id  = null;

         if (inkey) {
             key = inkey;
         } else {
             let info = this._get_crypto_key();
             if (info == null) {
                 return null;
              }
             [id, key] = info;
         }
         if (id)
              request.Id = id;

         let iv           = this._crypto.generateRandomIV();
         request.Nonce    = iv;
         request.Verifier = this._crypto.encrypt(iv, key, iv);
         return [id, key];
    },
    _send: function(request) {
        let thread = Services.tm.currentThread;
        let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
        xhr.open("POST", this._keepassHttpUrl, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        let r = JSON.stringify(request);
        this.log("REQUEST: " + r);
        xhr.send(r);
        while (xhr.readyState != 4) {
          thread.processNextEvent(true);
        }

        this.log("RESPONSE: " + xhr.status + " => " + xhr.responseText);
        return [xhr.status, xhr.responseText, xhr.readyState];
    },
    _success: function(s, readyState) {
        let success = s >= 200 && s <= 299;
        if (readyState < 2)  // request has not been sent yet
            return success;
        if (!success) {
            if (s == 503)
                this._showNotification("KeePass database is not open", null,
                                "kpf-db-note");
            else if (s == 0)
                this._showNotification("KeePassHttp is not running", null,
                                "kpf-running-note");
            else
                this._showNotification("Unknown KeePassHttp error: " + s, null,
                                "kpf-error-note");
        }
        return success;
    },
};
