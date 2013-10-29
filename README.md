# Mozilla 3e Calendar Provider

[Zonio][] [3e][] (pronounced as "threee") is a suite of client and
server applications which together provide electronic calendar
capabilities, calendar sharing and cross-platform scheduling support.

Mozilla 3e Calendar Provider is an add-on for Mozilla Thunderbird or
Postbox with Mozilla Lightning installed.  This add-on add support for
3e calendars, extends and fixes Lightning in some areas.

## Installation

Use Add-on Manager in your Thunderbird or Postbox and search for "3e
Calendar".  Alternatively, this add-on can be downloaded from [AMO][]
and then installed from a local file using Add-on Manager.

You can find more about installation and usage in our
[User Manual][manual].

## Development Environment

This extension relies on Mozilla Build System and Mozilla Thunderbird
with Mozilla Calendar header files.  Unfortunately, there's no SDK
provided by Mozilla nor by Zonio so you have to compile it yourself.
The extension also uses automated test runners which are part of
Mozilla Build System (e.g., xpcshell-tests).

1. Make sure you have all prerequisites as specified on [MDN][].
2. Clone comm-beta repository (`hg clone
   http://hg.mozilla.org/releases/comm-beta && cd comm-beta`)
3. Get development dependencies (`python ./client.py checkout`)
4. Create .mozconfig file:

       ac_add_options --enable-application=mail
       ac_add_options --enable-calendar
       ac_add_options --enable-extensions=calendar3e

5. Build the SDK (`./mozilla/mach build`)
6. Clone mozilla-3e repository (`git clone
   git://github.com/zonio/mozilla-3e.git
   mozilla/extensions/calendar3e`)
7. Build the 3e Calendar extension (`make -f client.mk`)
8. The extension is in obj-*/mozilla/dist/xpi-stage

There are many moving parts and the way described above is the
shortest one yet not the most convenient one for intensive
development.  Consult MDN to find a way which fits you best.

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

[zonio]: http://zonio.net "Zonio"
[3e]: http://zonio.net/calendar "3e Calendar"
[amo]: https://addons.mozilla.org/thunderbird/addon/3e-calendar/ "AMO: 3e Calendar"
[manual]: http://zonio.net/confluence/display/3E/Mozilla+3e+Calendar+User+Manual "Mozilla 3e Calendar User Manual"
[mdn]: https://developer.mozilla.org/en-US/docs/Developer_Guide/Build_Instructions/Linux_Prerequisites "UNIX/Linux Prerequisites"
