# install-here
[![Build Status](https://travis-ci.org/leolmi/install-here.svg)](https://travis-ci.org/leolmi/install-here)

Your packages as updatable templates

## Install
```
$ npm install install-here -g
``` 

## Use
Install npm package in folder you want. Launch this command in the folder 
```
$ install-here <package> [<options>]
```
the package will be downloaded directly in folder, not in node_modules, 
so you can update it simply reinstalling it (without specifying the name):
```
$ install-here
```

Similar to a basic [yeoman](http://yeoman.io/) but considering an npm package as template!

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
    
- **xpre**

    string value (es: `"gulp deploy"`).
    
    pre-execution script.
    
- **xpost**

    string value (es: `"gulp deploy"`).
    
    post-execution script.

    

## Flags

- -v, --version

    retrieve the version

- -f, --force

    force updates all files bypassing version check

- --verbose

    shows the verbose log
    
- -h, --help
    
    shows the help

- -p, --patch

    install in patch mode: save all files but package.json and dependencies.
    Not provide for pre/post actions. Like a merge to other package, different from current.

- -xpre, -xpost

    pre/post execution script
    ```
    $ install-here <package> --xpost "gulp deploy"
    ```

## Filename Filters

File names filters can be write gulp-like syntax:

filter | match
------------ | -------------
`your-file.ext` |  *specific filename*
`your/path/*.*` | *all files in your path (not in sub folders)*
`your/path/**/*.json` | *all .json files in your path and sub folders*
`your/path/**` | *all files in your path and sub folders*
`your/path/your-file*.*` | *all files in your path starts with "your-file"*
