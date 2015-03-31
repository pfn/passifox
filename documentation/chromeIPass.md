# chromeIPass

is an extension for the browser Google Chrome to send and receive credentials from KeePass through the plugin [KeePassHttp](https://github.com/pfn/keepasshttp).
<br />It can be downloaded from [Chrome Web Store](https://chrome.google.com/webstore/detail/chromeipass/ompiailgknfdndiefoaoiligalphfdae).

Please read at least the section [Important information](#6-important-information).

Table of content:

- [1. Features](#1-features)
- [2. Installation](#2-installation)
	- [2.1 Requirements](#21-requirements)
	- [2.2 Installation](#22-installation)
- [3. Functionality](#3-functionality)
	- [3.1 Access the credentials](#31-access-the-credentials)
		- [3.1.1 Popup](#311-popup)
		- [3.1.2 Autocomplete](#312-autocomplete)
		- [3.1.3 Context-menu](#313-context-menu)
		- [3.1.4 Shortcuts](#314-shortcuts)
	- [3.2 Password generator](#32-password-generator)
		- [3.2.1 How is the password generated?](#321-how-is-the-password-generated)
	- [3.3 Detection of credential fields](#33-detection-of-credential-fields)
	- [3.4 Choose own credential fields for a page](#34-choose-own-credential-fields-for-a-page)
	- [3.5 Remember passwords](#35-remember-passwords)
	- [3.6 Auto fill-in for HTTP Auth requests](#36-auto-fill-in-for-http-auth-requests)
	- [3.7 Fill-in additional values via String Fields](#37-fill-in-additional-values-via-string-fields)
- [4. Configuration and settings](#4-configuration-and-settings)
	- [4.1 Settings: General](#41-settings-general)
	- [4.2 Settings: Connected Databases](#42-settings-connected-databases)
	- [4.3 Settings: Specified credential fields](#43-settings-specified-credential-fields)
- [5. Tips and tricks](#5-tips-and-tricks)
- [6. Important information](#6-important-information)
- [7. Limitations and known problems](#7-limitations-and-known-problems)
	- [7.1 Remember credentials](#71-remember-credentials)
	- [7.2 Auto detection of input fields](#72-auto-detection-of-input-fields)
- [8. Troubleshooting](#8-troubleshooting)
	- [8.1 Wrong credentials are filled-in](#81-wrong-credentials-are-filled-in)
	- [8.2 chromeIPass stopped working](#82-chromeipass-stopped-working)
- [9. Security](#9-security)

## 1. Features

- secure integration with KeePass using the KeePassHttp plugin
- receive credentials from KeePass
- send new and updated entries to KeePass
- support multiple KeePass databases
	- select a unique icon for every database
- contains a [password generator](#32-password-generator) which works together with KeePass
- support multiple credentials for one page
	- select from popup
	- select from autocomplete
- support autocomplete for username fields
- support HTTP Auth requests (also known as htaccess-login)
- support additional field values via String Fields in KeePass
- support fill-in for dropdown menus (only for String Field values)
- accessible via context-menu of input fields
- accessible via [shortcuts](#314-shortcuts) (Ctrl+Shift+U and Ctrl+Shift+P)
- automatically detect field combinations of username + password
- automated password form fill if only one login combination is available
- choose own credential fields for every page
- checks for update of KeePassHttp

## 2. Installation

### 2.1 Requirements
- [KeePass](http://keepass.info) v2.17 or higher
- [KeePassHttp](https://github.com/pfn/keepasshttp) v1.0.7 or higher (recommended v1.4 or higher)
- it is recommended to disable the built-in Chrome password management when using this extension

### 2.2 Installation
1. Your database in KeePass has to be unlocked.
2. Go to the [Chrome Web Store](https://chrome.google.com/webstore/detail/chromeipass/ompiailgknfdndiefoaoiligalphfdae) and install the extension chromeIPass.
3. Now there is a new browser icon available:<br />
![browser-icon](https://raw.github.com/pfn/passifox/master/documentation/images/cip-browser-icon.png)

4. Click on the icon and press the button to connect to KeePassHttp:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-connect.png" alt="popup-connect" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-connect.png)

5. KeePassHttp shows you an dialog to give the pairing request a name. You could call it "Chrome on my main computer".<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/keepass-association-key.png" alt="keepass-association-key" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/keepass-association-key.png)

6. If you click on the browser icon again it should show you the following information:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-normal.png" alt="popup-normal" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-normal.png)

7. Reload the current page.
8. Open the settings to adjust chromeIPass for your needs.

## 3. Functionality

### 3.1 Access the credentials

If chromeIPass detected a combination of username + password fields it requests all credentials for the current page from KeePassHttp.<br />
The received credentials are accessible via multiple ways which are described in the following sections.

#### 3.1.1 Popup

The icon of chromeIPass gets a question mark.<br />
Clicking on the icon opens a popup on which you can choose the credentials which should be filled in.

If there are several username + password combinations on the page the credentials are filled into the focused combination (focus on username or password field) or into the first combination.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-choose-credentials.png" alt="popup choose credentials" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-choose-credentials.png)


#### 3.1.2 Autocomplete

For all combinations of username + password fields the username field supports autocomplete for the received credentials.

By clicking on an entry of the list or when the username field loose the focus it checks whether the username belongs to one of the received credentials and fills-in the password field.

This feature is activated by default and can be disabled on the settings page of chromeIPass.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-autocomplete.png" alt="autocomplete" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-autocomplete.png)

#### 3.1.3 Context-menu

On every textfield chromeIPass adds 3 entries to the context-menu.<br />
Even if the field was not detected as a username or password field by chromeIPass these entries are available.

If you click on _Fill User + Pass_ or _Fill Pass Only_ chromeIPass checks whether the focused field belongs to a detected combination of username + password field. If this check fails it starts a redetection for only the focused field.<br />
If you focus an unrecognized password field and select _Fill User + Pass_ it will automatically detect the username field and fills-in the credentials.

__Fill User + Pass__ of the context-menu will only work if chromeIPass received only one pair of credentials. Otherwise it shows you an error message and you should use the autocomplete or popup.

__Fill Pass Only__ does work either chromeIPass received only one pair of credentials or the associated username field contains a username which belongs to one pair of the received credentials.

__Show Password Generator Icons__ restarts the detection of _visible_ password fields on the page and adds the key-icon for the password generator to each of them.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-context-menu.png" alt="context-menu" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-context-menu.png)

#### 3.1.4 Shortcuts

chromeIPass supports 2 page-wide shortcuts:

__Ctrl+Shift+U__ is the shortcut for __Fill User + Pass__ of the context-menu which is described in [3.1.3](#313-context-menu).

__Ctrl+Shift+P__ is the shortcut for __Fill Pass Only__ of the context-menu which is also described in [3.1.3](#313-context-menu).


### 3.2 Password generator

chromeIPass offers a password generator which receives the password from KeePass itself.<br />
This function has to be enabled on the settings-page of chromeIPass.

This feature is only available with the KeePassHttp v1.4 or higher.

If it is enabled every password field contains a key icon on the right side. Click on it to open the password generator:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-password-generator.png" alt="password-generator" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-password-generator.png)

If the key-icon does not appear, right-click on the input-field and select _chromeIPass > Show Password Generator icons_ in the context-menu.

Once opened the generated password is stored in the field till you reload or submit the page or till you press the generate button. Even if you close the dialog and click on another key-icon the displayed password does not change.

Does a page contain more than one password field and you opened the dialog on the first password field, the option to fill-in the next field is enabled. If the two password fields are successive on the page, this option is also checked. Otherwise it is unchecked.

If the password field has a limited length for inputted text chromeIPass will detect it and automatically cut the generated password. It will inform you about this change and copy the cutted password to your clipboard.

__Because chromeIPass has some [limitations](#7-limitations-and-known-problems) to remember credentials the password should always be copied to your clipboard.__


#### 3.2.1 How is the password generated?

chromeIPass sends a request to KeePass which generates a password with the settings of the built-in profile for auto-generated passwords.<br />
To change the length and composition of generated passwords, please open the KeePass Password Generation Options.<br />
Go to Keepass > Tools > Generate Password... and this dialog opens:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/keepass-password-generation-options.png" alt="keepass-password-generation-options" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/keepass-password-generation-options.png)

1. Select the built-in profile _(Automatically generated passwords for new entries)_ and change the composition of the generated passwords.
2. Now click the _save_ button
3. A second dialog appears. Click on the down-arrow on the right side and select again the name of the built-in profile _(Automatically generated passwords for new entries)_.
4. Press OK and your changes are saved to the profile.


### 3.3 Detection of credential fields

1. After the page was loaded chromeIPass starts to search for all __visible__ input fields.
2. For every found input field of the type _password_ it checks whether the previous input field is a normal textfield.
	- if there is no previous field or the previous field is a password field --> don't add this fields as a detected username + password field combination.
	- if the previous field is a textfield --> add both fields as combination of username + password field.

The auto detection of credential fields is called only one time, after loading of the page finished.

There are known limitations when the auto detection cannot detect a username + password combination. Please go to [Limitations and known problems > Auto detection of input fields](#72-auto-detection-of-input-fields) to read more about it.

When it did not detect a username + password field combination you can click on the browser icon of chromeIPass and press the button "Redetect credential fields".

You can also use the shortcuts or context-menu as described in [3.1.3](#313-context-menu) to start the redetection for the focused field.


### 3.4 Choose own credential fields for a page

Sometimes there are other input fields between the username field and the password field.<br />
In this cases chromeIPass cannot detect the correct combination of username + password fields.

But you can define the combination by yourself for every page.<br />
Just click on the browser-icon of chromeIPass and press "Choose own credential fields for this page":<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-normal.png" alt="popup-normal" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-normal.png)

First there are all normal textfields highlighted. Click on the field you want to use as username field or skip this step if no username field is required.

Now choose a password field and in the last step confirm your selection.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-choose-credential-fields.png" alt="popup-normal" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-choose-credential-fields.png)

You can also choose additional fields, the so-called _String Fields_. Their functionality is described in [section 3.7](#37-fill-in-additional-values-via-string-fields).

The next time you open this page chromeIPass will use the defined combination of username + password field and does no longer auto detect combinations.

Certainly you can focus another field and use the context-menu ([3.1.3](#313-context-menu)) or shortcuts ([3.1.4](#314-shortcuts)) to start the detection for the focused field.


### 3.5 Remember passwords

Because Google Chrome does not offer an API for their built-in password manager chromeIPass implements it own way of detecting new or updated credentials.

If chromeIPass finds a combination of username + password fields it tries to get the corresponding form for them.<br />
For this form it registers a submit event which is called when the form is send.

__There are known limitations for this workflow which are described in [Limitations and known problems](#7-limitations-and-known-problems).__

If chromeIPass detects unsaved credentials the browser icon of chromeIPass starts blinking red.<br />
The icon will remain blinking till you click on it or you ignore it for 2 further page visits (loading other sites).

If you click on it, it remains completely red till you add, update or dismiss the detected changes.<br />
It shows you the corresponding URL and username and the database in which the changes will be saved.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-remember.png" alt="popup-normal" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-remember.png)

If you have multiple credentials for a page and want to update one entry you can press _Update_.<br />
Now a list of all available entries appears on which you can select the outdated entry. If the username matchs with one username of the available credentials this entry will be marked bold:

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-remember-update.png" alt="popup-normal" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-remember-update.png)

New entries are stored in a separate group in KeePass which will be added by KeePassHttp.

### 3.6 Auto fill-in for HTTP Auth requests

KeePassHttp returns the found credentials sorted by best matching URL to chromeIPass.<br />
chromeIPass can try to automatically login with the first provided credentials on HTTP Auth requests.<br />
If this login attempt fails the login dialog is shown as normal.

The dialog of an HTTP Auth request is shown in the following screenshot:

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/http-auth-request.png" alt="http auth request" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/http-auth-request.png)

This feature is activated by default and can be disabled in settings.

### 3.7 Fill-in additional values via String Fields

You can fill-in additional information by defining string fields.

1. Choose your own credential fields for the page like explained in [section 3.4](#34-choose-own-credential-fields-for-a-page). You can also skip both, username and password.
2. Now you can choose additional fields which are named _String Fields_. You can even choose dropdown elements.
The order you choose these string fields is important for the fill-in method!
3. Activate the _String Fields_ setting in KeePassHttp like explained in the [KeePassHttp-documentation (setting no. 11)](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options).
The alphanumeric ordered entries are mapped with the order you chose the String Fields.

Dropdown elements are filled in by the visible value. If you open a dropdown element you can see all available values. This visible value has to match with one String Field value from KeePass.

## 4. Configuration and settings

You don't need to configure chromeIPass.<br />
If chromeIPass does not have an authenticated connection to KeePassHttp it displays a red cross in the browser icon and requests you to establish a new connection.<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-connect.png" alt="popup-connect" width="200px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-popup-connect.png)

For further configurations you can open the settings which are accessible via the settings button in the popups, the context-menu of the browser icon (entry is called _Options_) or the tab _chrome://extensions_ on the chromeIPass-entry there is also a link called _Options_.

### 4.1 Settings: General

On the _General Settings_ you can enable and disable key features like autocomplete, password generator or auto fill for HTTP Auth requests.

The changes are saved immediately.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-general.png" alt="settings general" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-general.png)

### 4.2 Settings: Connected Databases

On the tab _Connected Databases_ chromeIPass shows you which databases are currently paired with KeePassHttp. You can also define a special icon for every database and see when it was last accessed.

The displayed icon depends on the database which is currently activated and unlocked in KeePass.

Removing an entry from chromeIPass __does not__ remove the key from KeePassHttp! But KeePassHttp is no longer able to send credentials to or receive data from chromeIPass for the currently activated database in KeePass.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-connected-databases.png" alt="settings general" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-connected-databases.png)


### 4.3 Settings: Specified credential fields

In [section 3.4](#34-choose-own-credential-fields-for-a-page) the function of _Choose own credential fields for this page_ is described.<br />
All credential fields which are defined with this function are listed on this tab.<br />
You can only remove them because it's not useful to define the fields manually.

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-specified-credential-fields.png" alt="settings general" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-settings-specified-credential-fields.png)

## 5. Tips and tricks

If the credential fields are not detected automatically you can focus one of the fields and press __Ctrl+Shift+U__ or __Ctrl+Shift+P__ to trigger redetecting the fields and filling-in the credentials. Also you can click on the browser icon and press the button _Redetect credential fields_.

If chromeIPass detects wrong credential fields choose them by yourself with the button _Choose own credential fields for this page_ which is available in every popup.

If chomeIPass always asks to unlock the database and this is annoying you, you can simply disable this feature in the [options of KeePassHttp](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options).

__It's always a good idea to have a look into the options of KeePassHttp. Maybe your feature request or problem is still implemented and can be solved by changing the options.__
[Go to the illustrated readme for the KeePassHttp options](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options)

#### Support multiple URLs for one username + password combination
This is natively supported by KeePass with the references feature. You can find an illustrated description in the [readme of KeePassHttp](https://github.com/pfn/keepasshttp#support-multiple-urls-for-one-username--password).

#### Disable the system tray notifications for found entries
Open the [options of KeePassHttp](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options) and disable the first feature.

#### Change the sort order of entries chromeIPass is displaying
Open the [options of KeePassHttp](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options) and switch the fifth feature.

## 6. Important information

- because Google Chrome does not offer an API to communicate with the built-in password manager chromeIPass needs to implement its own kind of password manager. [Please read the known limitations which belongs to that](#7-limitations-and-known-problems).

- for security reasons chromeIPass wipes out the temporarily stored credentials from cache every time you switch the tabs. Therefor it requests credentials for the current tab every time you switch on it.

## 7. Limitations and known problems

### 7.1 Remember credentials

Google Chrome does not offer an API to communicate with the password manager. Therefor chromeIPass implements its own way of checking for changed credentials.

On the form in which a combination of username + password fields is detected, chromeIPass registers an event which will be called when the form is submitted.

This event checks whether the submitted username and password have changed and shows the remember dialog.

But there exist several problems which we currently cannot overcome and which lead to not recognize the changes:

1. If the password field is cleared by some JavaScript code which hashes the value for example, chromeIPass can no longer access the value of the password and therefore no remember dialog is shown.
2. If there are page internal submit events registered on the form which will be triggered before our submit-request (for example: ajax calls), our request is possibly not triggered and no remember dialog will be shown.

Another problem is that chromeIPass cannot clearly differentiate between a successful and failed login attempt.<br />
The remember dialog will also be shown for failed login attempts.

### 7.2 Auto detection of input fields

#### 7.2.1 Problem
The detection does only detect fields which are __visible__ when this function is called.<br />
It is only one time called automatically: After loading of the page finished.

New input fields which are created with JavaScript or with an AJAX-call cannot be detected, because they get visible __after__ the auto detection was called.

For example an overlay for signin or signup could possibly not auto detected by chromeIPass because either the input fields are created just-in-time or they are hidden to the user while auto detection is running.

#### 7.2.2 Solution
When it did not detect any username + password field combination you can click on the browser icon of chromeIPass and press the button "Redetect credential fields".

You can also focus the visible username field or password field and press __Ctrl+Shift+U__. This will start a redetection for the focused field, too.

## 8. Troubleshooting

__First:__ Did you read the section [5. Tips and tricks](#5-tips-and-tricks)?
__Second:__ Did you checked your [KeePassHttp options](https://github.com/pfn/keepasshttp#settings-in-keepasshttp-options)? Maybe you only have to change the options...

If you [open an issue](https://github.com/pfn/passifox/issues/) always give us at least the following information:

1. chromeIPass version
2. Google Chrome version
2. KeePassHttp version
3. KeePass version
4. Pages on which the error occur

### 8.1 Wrong credentials are filled-in

1. Search in KeePass for the URL of the page on which the wrong credentials are filled-in.
2. Check the found entries for the credentials and confirm that the entries are up-to-date.

If this does not solve your problem, please [open an issue](https://github.com/pfn/passifox/issues/).

### 8.2 chromeIPass stopped working

#### 8.2.1 First check the running versions of your software

1. Check if you are using the [latest version of chromeIPass](https://chrome.google.com/webstore/detail/chromeipass/ompiailgknfdndiefoaoiligalphfdae).
2. Check if your browser Google chrome is up-to-date
3. Check if your versions of [KeePassHttp](https://github.com/pfn/keepasshttp) and [KeePass](http://www.keepass.info) are up-to-date

#### 8.2.2 Check the background page console for error messages
1. Open a tab with URL _chrome://extensions_ and activate the _Developer mode_ to be able to generate the background page:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-extensions-developer-mode.png" alt="extensions developer mode" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-extensions-developer-mode.png)

2. In the opened window choose the tab _Console_:<br />
[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-console-background.png" alt="background page console" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-console-background.png)

#### 8.2.3 Check the inline page console for error messages

In the page on which chromeIPass stopped working please press _F12_ or do a right-click and choose _Inspect Element_ from the context-menu. Now choose the tab _Console_ to open the console for the inline scripts:

[<img src="https://raw.github.com/pfn/passifox/master/documentation/images/cip-console-inline.png" alt="inline page console" width="300px" />](https://raw.github.com/pfn/passifox/master/documentation/images/cip-console-inline.png)

## 9. Security

- every communication with KeePass and KeePassHttp is encrypted with the symmetric version of AES in CBC-mode.
- the messages are crypted with a key of the length of 256bit.
- the communication happens via http://localhost on port 19455 on which KeePassHttp is listening.

The system is only in the moment of connecting a database to chromeIPass vulnerable. At this point KeePassHttp has to transmit the key to chromeIPass which will store it in the secured space of the extension. If someone records this traffic it could be possible to extract the key from it.

Any further communication is encrypted with this key and no longer vulnerable!

## Information

This readme was created by Lukas Schulze and last updated in April 2013.
