mozilla-plugin: all
all:
	rm -f 3E-Calendar.xpi
	zip -r 3E-Calendar.xpi content components js install.rdf chrome.manifest
