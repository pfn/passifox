const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;

const AES_KEY_URL = "chrome://keepassfox";
const KEEPASS_HTTP_URL = "http://localhost:19455/";

const KEEPASSFOX_CACHE_TIME = 30 * 1000; // milliseconds

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/services-crypto/WeaveCrypto.js");

function LoginManagerStorage() {
    this.wrappedJSObject = this;
    XPCOMUtils.defineLazyGetter(this, "_kpf", function() {
        return new KeePassFox();
    });
    this.log("Creating storage service");
}

LoginManagerStorage.prototype = {
    classDescription: "KeePassFox Login Manager Storage",
    classID:          Components.ID("{fa199659-10c4-4e3a-a73b-e2b4e1deae96}"),
    QueryInterface:   XPCOMUtils.generateQI([Ci.nsISupports,
                                             Ci.nsILoginManagerStorage]),
    _xpcom_factory: {
        createInstance: function(outer, iid) {
            if (outer != null)
                throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (!LoginManagerStorage.instance)
                LoginManagerStorage.instance = new LoginManagerStorage();
            return LoginManagerStorage.instance.QueryInterface(iid);
        },
    },
    uiBusy: false, // XXX seems to be needed in <=ff4.0b7
    log: function(m) {
        if (!this._kpf._debug)
            return;
        Services.console.logStringMessage("LoginManagerStorage: " + m);
    },
    stub: function(arguments) {
        if (!this._kpf._debug)
            return;
        let args = [];
        for (let i = 0; i < arguments.length; i++) {
            let arg = arguments[i];
            if (typeof(arg) == "object")
                arg = JSON.stringify(arg);
            args.push(arg);
        }
        this.log(arguments.callee.name + "(" + args.join(",") + ")");
    },

    init: function _init() { }, // don't need to init
    // ignored, no implementation
    initWithFile: function _initWithFile(inFile, outFile) { },

    addLogin: function addLogin(login) {
        this.stub(arguments);
        let r = {
                url: login.hostname,
                submiturl: login.formSubmitURL,
                username: login.username,
                password: login.password
        };

        login.QueryInterface(Ci.nsILoginMetaInfo);
        if (login.guid)
            r.uuid = login.guid;

        this._kpf.set_login(r);
        this._sendNotification("addLogin", login);
    },
    // not implemented--removals should be managed in KeePass
    removeLogin: function _removeLogin(login) {
        //this._sendNotification("removeLogin", login);
    },
    // XXX TODO implement me!
    modifyLogin: function modifyLogin(oldlogin, newlogindata) {
        this.stub(arguments);

        let newlogin = oldlogin.clone();
        if (newlogindata instanceof Ci.nsILoginInfo) {
        } else if (newlogindata instanceof Ci.nsIPropertyBag) {
        }

        //this._sendNotifiation("modifyLogin", [oldlogin, newlogin]);
    },
    getAllLogins: function getAllLogins(outCount) {
        this.stub(arguments);
        let entries = this._kpf.get_all_logins();
        outCount.value = entries.length;
        let logins = [];
        for (let i = 0; i < entries.length; i++) {
            let l = Cc['@mozilla.org/login-manager/loginInfo;1']
                    .createInstance(Ci.nsILoginInfo);
            l.hostname = entries[i].Name;
            l.username = entries[i].Login;
            l.password = "Stored in KeePass";
            l.usernameField = "";
            l.passwordField = "";
            l.QueryInterface(Ci.nsILoginMetaInfo);
            l.guid = entries[i].Uuid;
            logins.push(l);
        }
        return logins;
    },
    getAllEncryptedLogins: function getAllEncryptedLogins(outCount) {
        return this.getAllLogins(outCount);
    },
    searchLogins: function searchLogins(count, matchData) {
        this.stub(arguments);
        // this appears to be used by weave/sync, don't need it
        outCount.value = 0;
        return [];
    },

    removeAllLogins: function() { }, // never, ever do this
    // hosts are never disabled
    getAllDisabledHosts: function(outCount) {
        outCount.value = 0;
        return [];
    },
    getLoginSavingEnabled: function(hostname) { return true; }, // always true
    setLoginSavingEnabled: function(hostname, enabled) { }, // ignore

    findLogins: function findLogins(outCount, hostname, submitURL, realm) {
        this.stub(arguments);

        let entries = this._kpf.get_logins(hostname, submitURL);
        outCount.value = entries.length;
        let logins = [];
        for (let i = 0; i < entries.length; i++) {
            let l = Cc['@mozilla.org/login-manager/loginInfo;1']
                    .createInstance(Ci.nsILoginInfo);
            l.hostname      = hostname;
            l.formSubmitURL = submitURL;
            l.username      = entries[i].Login;
            l.password      = entries[i].Password;
            l.usernameField = "";
            l.passwordField = "";
            l.QueryInterface(Ci.nsILoginMetaInfo);
            l.guid = entries[i].Uuid;
            logins.push(l);
        }
        return logins;
    },
    countLogins: function countLogins(hostname, submitURL, realm) {
        this.stub(arguments);
        let c = this._kpf.get_logins_count(hostname);
        return c;
    },
    // copied from storage-mozStorage.js
    _sendNotification: function(changeType, data) {
        let dataObject = data;
        // Can't pass a raw JS string or array though notifyObservers(). :-(
        if (data instanceof Array) {
            dataObject = Cc["@mozilla.org/array;1"].
                         createInstance(Ci.nsIMutableArray);
            for (let i = 0; i < data.length; i++)
                dataObject.appendElement(data[i], false);
        } else if (typeof(data) == "string") {
            dataObject = Cc["@mozilla.org/supports-string;1"].
                         createInstance(Ci.nsISupportsString);
            dataObject.data = data;
        }
        Services.obs.notifyObservers(dataObject,
                "passwordmgr-storage-changed", changeType);
    },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([LoginManagerStorage]);

function KeePassFox() {
    XPCOMUtils.defineLazyGetter(this, "_mozStorage", function() {
        let contract = "@mozilla.org/login-manager/storage/mozStorage;1";
        let storage = Cc[contract].createInstance(Ci.nsILoginManagerStorage);
        storage.init();
        return storage;
    });
    XPCOMUtils.defineLazyGetter(this, "_crypto", function() {
        return new WeaveCrypto();
    });

    this._prefBranch = Services.prefs.getBranch("signon.");
    let kpf = this;
    this._observer = {
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                               Ci.nsISupportsWeakReference]),
        observe: function(subject, topic, data) {
            kpf._debug = kpf._prefBranch.getBoolPref("debug");
            kpf.log("debug pref updated: " + kpf._debug);
        }
    };
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this._prefBranch.addObserver("debug", this._observer, false);
    this._debug = this._prefBranch.getBoolPref("debug");
}

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
        l.hostname = AES_KEY_URL;
        l.username = id;
        l.password = key;
        l.usernameField = "";
        l.passwordField = "";
        storage.addLogin(l);
    },
    _find_cache_item: function(url, submiturl) {
        let key = url + "!!" + submiturl;
        let item = this._cache[key];
        let now = Date.now();
        if (item && (item.ts + KEEPASSFOX_CACHE_TIME) > now) {
            item.ts = now;
            return item.entries;
        }
        return null;
    },
    _cache_item: function(url, submiturl, entries) {
        let key = url + "!!" + submiturl;
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
            request.Uuid = this._crypto.encrypt(login.uuid, key, iv);

        let [s, response] = this._send(request);
        if (this._success(s)) {
            let r = JSON.parse(response);
            if (this._verify_response(r, key, id)) {
                this.log("saved login for: " + login.url);
            } else {
                this._showNotification(
                        "set_login for " + login.url + " rejected");
            }
        }
    },
    get_logins: function(url, submiturl, force) {
        let cached = this._find_cache_item(url, submiturl);
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
        let [s, response] = this._send(request);
        let entries = [];
        if (this._success(s)) {
            let r = JSON.parse(response);
            if (this._verify_response(r, key, id)) {
                let iv = r.Nonce;
                for (let i = 0; i < r.Entries.length; i++) {
                    this._decrypt_entry(r.Entries[i], key, iv);
                }
                entries = r.Entries;
                this._cache_item(url, submiturl, entries);
            } else {
                this._cache_item(url, submiturl, []);
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
        let [s, response] = this._send(request);
        let entries = [];
        if (this._success(s)) {
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
        let [s, response] = this._send(request);
        let entries = [];
        if (this._success(s)) {
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
        let win     = Services.wm.getMostRecentWindow("navigator:browser");
        if (id) {
            let notif = win.document.getElementById(id);
            if (notif)
                return notif;
        }
        let browser = win.gBrowser;
        let box     = browser.getNotificationBox(browser.selectedBrowser);
        let n       = box.appendNotification(m, null,
                "chrome://keepassfox/skin/keepass.png", 3, buttons);
        // let the notification show for 30 seconds
        n.timeout = Date.now() + 30 * 1000;
        if (id)
            n.setAttribute("id", id);
        return n;
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

        let [s, response] = this._send(request);
        if (this._success(s)) {
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
        let [s, response] = this._send(request);
        if (this._success(s)) {
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
        let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
        xhr.open("POST", KEEPASS_HTTP_URL, false);
        xhr.setRequestHeader("Content-Type", "application/json");
        try {
            let r = JSON.stringify(request);
            this.log("REQUEST: " + r);
            xhr.send(r);
        }
        catch (e) { this.log("KeePassHttp: " + e); }
        this.log("RESPONSE: " + xhr.status + " => " + xhr.responseText);
        return [xhr.status, xhr.responseText];
    },
    _success: function(s) {
        let success = s >= 200 && s <= 299;
        if (!success) {
            if (s == 503)
                this._showNotification("KeePass database is not open");
            else if (s == 0)
                this._showNotification("KeePassHttp is not running");
            else
                this._showNotification("Unknown KeePassHttp error: " + s);
        }
        return success;
    },
};
