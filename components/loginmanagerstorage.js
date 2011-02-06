const Ci = Components.interfaces;
const Cu = Components.utils;
const Cc = Components.classes;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://passifox/modules/KeePassFox.jsm");

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
        if (login.httpRealm)
            r.realm = login.httpRealm;

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

    modifyLogin: function modifyLogin(oldLogin, newLoginData) {
        let newLogin;
        let needsUpdate = false;
        newLogin = oldLogin.clone().QueryInterface(Ci.nsILoginMetaInfo);
        if (newLoginData instanceof Ci.nsILoginInfo) {
            newLogin.init(newLoginData.hostname,
                    newLoginData.formSubmitURL, newLoginData.httpRealm,
                    newLoginData.username, newLoginData.password,
                    newLoginData.usernameField, newLoginData.passwordField);
            newLogin.QueryInterface(Ci.nsILoginMetaInfo);

            if (newLogin.username != oldLogin.username) {
                this.log("Updating username");
                needsUpdate = true;
            }
            if (newLogin.password != oldLogin.password) {
                this.log("Updating password");
                needsUpdate = true;
            }
        }  else if (newLoginData instanceof Ci.nsIPropertyBag) {
            let propEnum = newLoginData.enumerator;
            while (propEnum.hasMoreElements()) {
                let prop = propEnum.getNext().QueryInterface(Ci.nsIProperty);
                switch (prop.name) {
                    // nsILoginInfo properties...
                    //
                    // only care about these 4 for updating
                    case "hostname":
                    case "username":
                    case "password":
                    case "formSubmitURL":
                        needsUpdate = true;
                        this.log("updating field: " + prop.name);
                    case "usernameField":
                    case "passwordField":
                    case "httpRealm":
                    // nsILoginMetaInfo properties...
                    case "guid":
                    case "timeCreated":
                    case "timeLastUsed":
                    case "timePasswordChanged":
                    case "timesUsed":
                        if (prop.name == "guid") {
                            this.log("Guid is changing?!  Not supported");
                            break;
                        }
                        newLogin[prop.name] = prop.value;
                        break;

                    // Fake property, allows easy incrementing.
                    case "timesUsedIncrement":
                        newLogin.timesUsed += prop.value;
                        break;

                    // Fail if caller requests setting an unknown property.
                    default:
                        throw "Unexpected propertybag item: " + prop.name;
                }
            }
        } else {
            throw "newLoginData needs an expected interface!";
        }
        if (needsUpdate) {
            this.addLogin(newLogin);
            this._sendNotification("modifyLogin", [oldLogin, newLogin]);
        }
    },
    getAllLogins: function getAllLogins(outCount) {
        this.stub(arguments);
        let entries = this._kpf.get_all_logins();
        outCount.value = entries.length;
        let logins = [];
        for (let i = 0; i < entries.length; i++) {
            let l = Cc['@mozilla.org/login-manager/loginInfo;1']
                    .createInstance(Ci.nsILoginInfo);
            l.init(entries[i].Name, null, null,
                    entries[i].Login, "Stored in KeePass", "", "");
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
        count.value = 0;
        return [];
    },

    removeAllLogins: function() { }, // never, ever do this
    // hosts are never disabled
    getAllDisabledHosts: function(count) {
        count.value = 0;
        return [];
    },
    getLoginSavingEnabled: function(hostname) { return true; }, // always true
    setLoginSavingEnabled: function(hostname, enabled) { }, // ignore

    findLogins: function findLogins(outCount, hostname, submitURL, realm) {
        this.stub(arguments);

        let entries = this._kpf.get_logins(hostname, submitURL, false, realm);
        outCount.value = entries.length;
        let logins = [];
        for (let i = 0; i < entries.length; i++) {
            let l = Cc['@mozilla.org/login-manager/loginInfo;1']
                    .createInstance(Ci.nsILoginInfo);
            l.init(hostname, submitURL, realm,
                    entries[i].Login, entries[i].Password, "", "");
            l.QueryInterface(Ci.nsILoginMetaInfo);
            l.guid = entries[i].Uuid;
            logins.push(l);
        }
        return logins;
    },
    // is there anything wrong with always returning a non-zero value?
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

