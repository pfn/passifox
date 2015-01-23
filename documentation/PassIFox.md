# PassIFox

PassIFox extension for Firefox4+

Implements a transparent replacement for the built-in Firefox password storage

This extension is for use with [KeePassHttp](https://github.com/pfn/keepasshttp)

The XPI can be installed using the link: https://passifox.appspot.com/passifox.xpi

### Prereqs

1. [KeePass](http://keepass.info/)
2. [KeePassHttp](https://github.com/pfn/keepasshttp/)

### Installation

[Download PassIFox](https://passifox.appspot.com/passifox.xpi) and drag-n-drop it into your Firefox. The installation process should start.

### Configuration

There is no explicit configuration necessary. PassIFox and KeePassHttp
will communicate with each other on http://localhost:19455/

When a login form is discovered for the first time, PassIFox will
initialize itself and request an "Association" with KeePass (KeePassHttp).
Alternatively, for forms that do not fill automatically, a context menu
item on text and password fields allow manually filling in a login.

Once that is completed, Firefox can freely retrieve passwords from
KeePass. KeePass must be running and unlocked in order for passwords
to be available.

Entries in KeePass can be stored as http://host.name/ or just host.name
without any extra fluff. KeePassHttp will do the work to figure out what
you want. There are some permissions things where KeePassHttp will
notify you when passwords are requested and the hostnames do not exactly
match. When those prompts occur, you can accept, deny and remember your
choice.

For example, take the URL "http://www.google.com/" the entry in KeePass
can be named http://www.google.com, www.google.com, or google.com
Any will match a request for passwords, but if the entry is named
google.com, and a request for comes from http://www.google.com you
will be prompted to approve the request, and if you like, you can choose
to remember the selection so that you are not prompted again.

NOTE: Keep in mind, the field in which you put the names is the 'Title'
field, and not 'URL'.  Use 'URL' to store a shortcut link that will take
you to your site.  Use the 'Title' field to match sites for logins.