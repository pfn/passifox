KeePass integration for browser Chrome using KeePassHttp

NEW UPDATE, Version 2.2.1, brings many requested features to ChromeIPass.

ChromeIPass brings KeePass integration to the Google Chrome browser!

For users of KeePass 2.17 and newer, please make sure to use KeePassHttp 1.0.4.0 or newer; previous versions will not work.  For users of KeePass 2.16 and older, be sure to use KeePassHttp 1.0.3.9 and lower. It is strongly recommended that you use the latest versions of KeePassHttp and KeePass.

Changes:
2.3.4: Lukas Schulze: fix "checking status" bug
2.3.3: Lukas Schulze: added permissions for update-function for KeePassHttp; added keyboard support for context-menu;  fixed escaping identifiers;  fixed detection of field combinations when pressing Ctrl+Shift+U; redesigned dialog of password-generator
2.3.1: Lukas Schulze: added password-generator (only works with the latest version of KeePassHttp, disabled for older versions); changed the way of identifying and accessing credential fields (no longer uses only the ID of an field, because several sites don't use unique IDs); improved feature choose-own-credential-fields
2.2.3: Lukas Schulze: fix jQuery css styling issues (chromeipass no longer override web-site appearance). Fix jquery date pickers.
2.2.1: Update to webstore manifest version2. Completely re-worked for the updated Chrome extension APIs, supports updating and saving new KeePass entries, supports HTTP authentication (Basic and Digest auth). Many more new features. All new enhancements are courtesy of Lukas Schulze, thank you!
1.0.7: fix forms that use HTML5's type="email" for username (e.g. amazon)
1.0.4: minor bugfix in getFields, filter user fields to only be text
1.0.6: utf8 support for login and password fields, thanks DeniSix

Support:
* Please post any questions or support issues at the github messenger/tracker (the "Developer Website" link to the right)

Features:
* Secure integration with KeePass using the KeePassHttp plugin (https://github.com/pfn/keepasshttp/ download from https://passifox.appspot.com/KeePassHttp.plgx)
* Automated password form fill
* Support for multiple logins at a single site (intuitive pageAction-based workflow)
* Context menu entries for manually selecting username and password fields to fill
* Notifications are always displayed whenever passwords are retrieved from KeePass, in some instances it is even possible to deny and allow access. (When the host names do not match exactly, user interaction is required to allow access; the decision can be remembered).
* Open source, available for inspection at https://github.com/pfn/passifox
* Also supported on Firefox4: use the same KeePass database for Google Chrome and Firefox

Future features and enhancements:
* Automatic password generation and entry creation

Requirements:
* KeePass 2 (http://keepass.info) version 2.17 or newer
* KeePassHttp (https://github.com/pfn/keepasshttp/ download at https://passifox.appspot.com/KeePassHttp.plgx)

Directions:
1) Install KeePass
2) Install KeePassHttp by dropping KeePassHttp.plgx into the KeePass Program Files directory
2a) Log into KeePass
2b) Verify KeePassHttp has been installed correctly by checking Tools > Plugins
3) Navigate to any page containing a password
4) Click the KeePass icon in the URL bar and click the "Connect" button
5) Switch to the KeePass window and enter a descriptive name for your "Chrome Browser" into the dialog that popped up and click save.
6) Your passwords are now securely retrieved from KeePass and automatically entered into password forms and fields when needed.
7) Passwords in KeePass should be entered with the "Title" containing the domain or host name for the site in question; KeePassHttp does some basic pattern matching, for example "google.com" would match http://login.google.com/ if there were such a thing. (KeePassHttp 1.0.2.0 now searches the "URL" field in the same way)
8) If you are ever lost, click on the KeePass icon in the URL bar and it will let you know status as well as any available options.

Linux and Mac users:
If you are using KeePass with Mono, then you're in luck.  I have tested KeePassHttp with Mono 2.6.7 and it appears to work well.  I cannot get the plgx file to work on Linux, perhaps you may have more luck, but I can get my dll files to work directly when put into the KeePass directory (possibly the Plugin directory as well, I have not tried).  You can get KeePassHttp.dll and Newtonsoft.Json.dll from https://github.com/pfn/keepasshttp/tree/master/KeePassHttp

Windows users:
If the PLGX file does not work, it is possible to use the DLL files as mentioned above for Linux and Mac users. The above DLLs are universal binaries and work cross-platform.

It is recommended to disable the builtin Chrome password management when using this extension.