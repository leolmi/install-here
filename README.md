# install-here
[![Build Status](https://travis-ci.org/leolmi/install-here.svg)](https://travis-ci.org/leolmi/install-here)

##Install
```
$ npm install install-here -g
``` 

(beta version)
install npm package on root:
You can use one package as a project running 
```
$ install-here <package>
```
package will be downloaded on working directory, not in node_modules, 
so you can update it simply reinstalling it.

##Options
Options can be defined using file
```
install-here.json
```
saved on working directory

####ignore
```
"ignore": "*.yml;package.json;favicon.ico;*.jpg"
```
Every file match with ignore filter will be skipped.

####ignoreOverwrite
```
"ignoreOverwrite": "*.json"
```
Every existing file match with ignoreOverwrite filter will be skipped.

####checkVersion
```
"checkVersion": true
```
Cancel upgrade the package if the version is the same as the remote one.