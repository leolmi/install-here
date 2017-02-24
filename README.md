# install-here
[![Build Status](https://travis-ci.org/leolmi/install-here.svg)](https://travis-ci.org/leolmi/install-here)

## Install
```
$ npm install install-here -g
``` 

Install npm package in folder you want. Launch this command in the folder 
```
$ install-here <package>
```
package will be downloaded directly in folder, not in node_modules, 
so you can update it simply reinstalling it.

Similar to [yeoman](http://yeoman.io/) but considering the npm packages as templates!

## Options
Options can be defined using file
```
install-here.json
```
saved on working directory

- **ignore**

    string value (es: `"*.yml;package.json;favicon.ico;*.jpg"`).
    Every file match with this [filter](#filename-filters) will be skipped.

- **ignoreOverwrite**

    string value (es: `"*.json"`).
    Every existing file match with this [filter](#filename-filters) will be skipped.

- **ignorePath**

    string value (es: `"my/folder/**"`).
    Every file match with this [filter](#filename-filters) will be skipped if path exists.

- **checkVersion**

    boolean value.
    Cancel upgrade the package if the version is the same as the remote one.

## Flags

- -v, --version

    retrieve the version
    ```
    $ install-here -v
    ```

- -f, --force

    force updates all files bypassing version check
    ```
    $ install-here <package> -f
    ```

## Filename Filters

File names filters can be write gulp-like syntax:

filter | result
------------ | -------------
`your-file.ext` |  *specific filename*
`your/path/*.*` | *all files in your path (not in sub folders)*
`your/path/**/*.json` | *all .json files in your path and sub folders*
`your/path/**` | *all files in your path and sub folders*
`your/path/your-file*.*` | *all files in your path starts with "your-file"*
